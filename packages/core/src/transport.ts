/**
 * HTTP transport — request lifecycle and retry loop.
 *
 * Single public entry point: {@link createTransport} returns a `request`
 * function the resource layer composes against. Owns:
 *
 *   - request orchestration (build request, send, decide whether to retry)
 *   - the retry loop (bounded by `maxRetries` AND `maxTotalRetryMs`)
 *   - timeout enforcement via `AbortController`
 *   - turning a failed attempt into a typed {@link GranolaError}
 */

import { type ResolvedGranolaClientConfig } from './config.js';
import { type GranolaError, GranolaNetworkError } from './errors.js';
import { mapHttpError } from './http-errors.js';
import {
  buildUrl,
  computeBackoffMs,
  parseErrorBody,
  parseRetryAfterMs,
  parseSuccessBody,
  type QueryParams,
} from './http-helpers.js';

export type HttpMethod = 'GET';

export interface RequestOptions {
  method: HttpMethod;
  /** Path beginning with `/` — joined to `baseUrl`. */
  path: string;
  /** Optional querystring values. `undefined` / `null` entries are dropped. */
  query?: QueryParams;
  /** Override the per-request timeout in ms. */
  timeoutMs?: number;
}

export type RequestFn = <T>(options: RequestOptions) => Promise<T>;

export function createTransport(config: ResolvedGranolaClientConfig): RequestFn {
  return <T>(options: RequestOptions) => sendRequest<T>(config, options);
}

async function sendRequest<T>(
  config: ResolvedGranolaClientConfig,
  options: RequestOptions,
): Promise<T> {
  const url = buildUrl(config.baseUrl, options.path, options.query);
  const init = buildRequestInit(config.apiKey, options);
  const timeoutMs = options.timeoutMs ?? config.timeoutMs;

  let attempt = 0;
  let totalSlept = 0;

  for (;;) {
    const result = await tryOnce(config, url, init, timeoutMs);

    if (result.kind === 'success') {
      return result.value as T;
    }

    const isLastAttempt = attempt >= config.maxRetries;
    if (!result.retriable || isLastAttempt) {
      throw result.error;
    }

    const delayMs = result.retryAfterMs ?? computeBackoffMs(config.retryBaseMs, attempt);
    if (totalSlept + delayMs > config.maxTotalRetryMs) {
      throw result.error;
    }

    await config.sleep(delayMs);
    totalSlept += delayMs;
    attempt += 1;
  }
}

type AttemptResult =
  | { kind: 'success'; value: unknown }
  | { kind: 'failure'; error: GranolaError; retriable: boolean; retryAfterMs?: number };

async function tryOnce(
  config: ResolvedGranolaClientConfig,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<AttemptResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await config.fetch(url, { ...init, signal: controller.signal });
  } catch (cause) {
    return {
      kind: 'failure',
      error: new GranolaNetworkError(
        cause instanceof Error ? `Network error: ${cause.message}` : 'Network error',
        cause,
      ),
      retriable: true,
    };
  } finally {
    clearTimeout(timeoutId);
  }

  const status = response.status;
  const requestId = response.headers.get('x-request-id') ?? undefined;

  if (status >= 200 && status < 300) {
    return { kind: 'success', value: await parseSuccessBody(response) };
  }

  const body = await parseErrorBody(response);
  const error = mapHttpError(status, body, requestId, response.headers);
  const retriable = status === 429 || (status >= 500 && status <= 599);
  const retryAfterMs = status === 429 ? parseRetryAfterMs(response.headers) : undefined;
  return { kind: 'failure', error, retriable, retryAfterMs };
}

function buildRequestInit(apiKey: string, options: RequestOptions): RequestInit {
  return {
    method: options.method,
    headers: {
      authorization: `Bearer ${apiKey}`,
      accept: 'application/json',
    },
  };
}

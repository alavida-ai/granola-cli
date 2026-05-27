/**
 * Stateless HTTP helpers used by the transport layer. Pure functions; no I/O,
 * no shared state. URL composition, response decoding, retry timing math.
 */

import type { GranolaErrorBody } from './errors.js';

// ─── URL composition ─────────────────────────────────────────────────────────

export function buildUrl(baseUrl: string, path: string, query: QueryParams | undefined): string {
  const trimmedBase = baseUrl.replace(/\/$/, '');
  const trimmedPath = path.startsWith('/') ? path : `/${path}`;
  const qs = query ? toQueryString(query) : '';
  return `${trimmedBase}${trimmedPath}${qs}`;
}

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

export function toQueryString(query: QueryParams): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.append(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

// ─── Response body decoding ──────────────────────────────────────────────────

/** Parse a 2xx body. Returns `undefined` for 204 / empty; raw text if not JSON. */
export async function parseSuccessBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (text.length === 0) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Parse a non-2xx body. JSON if possible, raw text otherwise, `undefined` if empty. */
export async function parseErrorBody(
  response: Response,
): Promise<GranolaErrorBody | string | undefined> {
  let text: string;
  try {
    text = await response.text();
  } catch {
    return undefined;
  }
  if (!text) return undefined;
  try {
    return JSON.parse(text) as GranolaErrorBody;
  } catch {
    return text;
  }
}

// ─── Retry timing ────────────────────────────────────────────────────────────

export function parseRetryAfterMs(headers: Headers): number | undefined {
  const seconds = parseRetryAfterSeconds(headers);
  return seconds === undefined ? undefined : seconds * 1_000;
}

export function parseRetryAfterSeconds(headers: Headers): number | undefined {
  const raw = headers.get('retry-after');
  if (!raw) return undefined;
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && asNumber >= 0) return asNumber;
  const date = Date.parse(raw);
  if (Number.isFinite(date)) {
    return Math.max(0, Math.round((date - Date.now()) / 1_000));
  }
  return undefined;
}

/** Exponential backoff: `baseMs * 2^attempt`. */
export function computeBackoffMs(baseMs: number, attempt: number): number {
  return baseMs * 2 ** attempt;
}

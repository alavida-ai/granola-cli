/** Default base URL for the Granola public API. */
export const DEFAULT_BASE_URL = 'https://public-api.granola.ai';

/** Default per-request timeout in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Default maximum number of retry attempts after the initial request. */
export const DEFAULT_MAX_RETRIES = 3;

/** Base delay for exponential backoff, in milliseconds. */
export const DEFAULT_RETRY_BASE_MS = 1_000;

/** Maximum cumulative wait time across retries, in milliseconds. */
export const DEFAULT_MAX_TOTAL_RETRY_MS = 30_000;

/**
 * Configuration for {@link GranolaClient}. Only `apiKey` is required.
 *
 * Override `fetch` / `sleep` to make the client deterministic in tests.
 */
export interface GranolaClientConfig {
  /** Granola API key (`grn_...`). Sent as `Authorization: Bearer ${apiKey}`. */
  apiKey: string;
  /** Override the Granola base URL (default: {@link DEFAULT_BASE_URL}). */
  baseUrl?: string;
  /** Per-request timeout in ms (default: {@link DEFAULT_TIMEOUT_MS}). */
  timeoutMs?: number;
  /** Max retry attempts after the initial request (default: {@link DEFAULT_MAX_RETRIES}). */
  maxRetries?: number;
  /** Base ms for exponential backoff (default: {@link DEFAULT_RETRY_BASE_MS}). */
  retryBaseMs?: number;
  /** Cap on total time spent waiting between retries (default: {@link DEFAULT_MAX_TOTAL_RETRY_MS}). */
  maxTotalRetryMs?: number;
  /** Override the global `fetch` (for testing). */
  fetch?: typeof globalThis.fetch;
  /** Override the sleep function (for testing — avoids real timers). */
  sleep?: (ms: number) => Promise<void>;
}

/** Internal config with defaults filled in. */
export interface ResolvedGranolaClientConfig {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
  retryBaseMs: number;
  maxTotalRetryMs: number;
  fetch: typeof globalThis.fetch;
  sleep: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export function resolveConfig(config: GranolaClientConfig): ResolvedGranolaClientConfig {
  if (!config.apiKey) {
    throw new Error('GranolaClient: `apiKey` is required.');
  }
  return {
    apiKey: config.apiKey,
    baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
    retryBaseMs: config.retryBaseMs ?? DEFAULT_RETRY_BASE_MS,
    maxTotalRetryMs: config.maxTotalRetryMs ?? DEFAULT_MAX_TOTAL_RETRY_MS,
    fetch: config.fetch ?? globalThis.fetch.bind(globalThis),
    sleep: config.sleep ?? defaultSleep,
  };
}

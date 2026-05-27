/**
 * Error hierarchy for `@alavida-ai/granola-core`.
 *
 * Every Granola API failure surfaces as a {@link GranolaError} subclass.
 * Consumers should branch on `instanceof` rather than status codes — typed
 * errors carry decoded context (e.g. `retryAfterSeconds`).
 */

/** Shape Granola returns inside JSON error bodies. Loosely typed — we probe a couple of keys. */
export interface GranolaErrorBody {
  message?: string;
  error?: string;
  code?: string;
  [k: string]: unknown;
}

/** Base class for every Granola SDK error. */
export class GranolaError extends Error {
  /** HTTP status returned by Granola. `0` for transport-level (network) errors. */
  readonly status: number;

  /** Parsed JSON body if available; the raw string if Granola returned non-JSON. */
  readonly body: GranolaErrorBody | string | undefined;

  /** `x-request-id` header from the failing response, when present. */
  readonly requestId?: string;

  constructor(
    message: string,
    status: number,
    body: GranolaErrorBody | string | undefined,
    requestId?: string,
  ) {
    super(message);
    this.name = 'GranolaError';
    this.status = status;
    this.body = body;
    this.requestId = requestId;
  }
}

/** 401 Unauthorized — bad / missing / expired API key. */
export class GranolaAuthError extends GranolaError {
  constructor(body: GranolaErrorBody | string | undefined, requestId?: string) {
    super('Granola authentication failed (401). Check GRANOLA_API_KEY.', 401, body, requestId);
    this.name = 'GranolaAuthError';
  }
}

/** 404 Not Found — note / folder id does not exist or is not visible to this key. */
export class GranolaNotFoundError extends GranolaError {
  constructor(
    message: string,
    body: GranolaErrorBody | string | undefined,
    requestId?: string,
  ) {
    super(message, 404, body, requestId);
    this.name = 'GranolaNotFoundError';
  }
}

/** 429 Too Many Requests, surfaced after retries are exhausted. */
export class GranolaRateLimitError extends GranolaError {
  readonly retryAfterSeconds: number | undefined;

  constructor(
    retryAfterSeconds: number | undefined,
    body: GranolaErrorBody | string | undefined,
    requestId?: string,
  ) {
    const suffix = retryAfterSeconds !== undefined ? ` Retry after ${retryAfterSeconds}s.` : '';
    super(`Granola rate limit exceeded (429).${suffix}`, 429, body, requestId);
    this.name = 'GranolaRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** 5xx — Granola (or its upstream) failed; retries already exhausted. */
export class GranolaServerError extends GranolaError {
  constructor(
    message: string,
    status: number,
    body: GranolaErrorBody | string | undefined,
    requestId?: string,
  ) {
    super(message, status, body, requestId);
    this.name = 'GranolaServerError';
  }
}

/** Transport-level error — `fetch` itself threw (DNS, TCP, abort). */
export class GranolaNetworkError extends GranolaError {
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message, 0, undefined);
    this.name = 'GranolaNetworkError';
    this.cause = cause;
  }
}

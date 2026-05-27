/**
 * Error-to-tool-response mapping for the granola plugin.
 *
 * Every typed error from `@alavida-ai/granola-core` is mapped to a stable,
 * machine-readable response the agent can branch on. Tool execute bodies wrap
 * themselves in {@link withErrorMapping} so OpenClaw never sees a raw
 * exception — the agent always gets either the normal return value or a
 * `{ __toolError: {...} }` envelope.
 */
import {
  GranolaAuthError,
  GranolaError,
  GranolaNetworkError,
  GranolaNotFoundError,
  GranolaRateLimitError,
  GranolaServerError,
} from '@alavida-ai/granola-core';

export interface ToolErrorResponse {
  /** Machine-readable error code (stable). */
  error: string;
  /** Human-readable explanation. */
  message: string;
  /** Suggested next step for the agent. Stable across runs. */
  hint?: string;
  /** GranolaRateLimitError — `Retry-After` seconds, when present. */
  retryAfterSeconds?: number;
}

export interface ToolErrorEnvelope {
  __toolError: ToolErrorResponse;
}

export function isToolErrorEnvelope(value: unknown): value is ToolErrorEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__toolError' in value &&
    typeof (value as { __toolError: unknown }).__toolError === 'object'
  );
}

/**
 * Wrap a tool body. Returns the body's value on success, or a
 * {@link ToolErrorEnvelope} when any error is thrown.
 */
export async function withErrorMapping<T>(
  toolName: string,
  fn: () => Promise<T>,
): Promise<T | ToolErrorEnvelope> {
  try {
    return await fn();
  } catch (e) {
    return { __toolError: mapError(toolName, e) };
  }
}

function mapError(_toolName: string, e: unknown): ToolErrorResponse {
  if (e instanceof GranolaAuthError) {
    return {
      error: 'auth_failed',
      message: 'Granola authentication failed. The API key is invalid or expired.',
      hint: 'Tell the user to refresh GRANOLA_API_KEY in the Granola desktop app (Settings → API). Do not retry.',
    };
  }
  if (e instanceof GranolaNotFoundError) {
    return {
      error: 'not_found',
      message: e.message,
      hint: 'Confirm the note or folder id with the user. List endpoints will surface valid ids.',
    };
  }
  if (e instanceof GranolaRateLimitError) {
    return {
      error: 'rate_limited',
      message: e.message,
      hint: 'Wait the suggested duration, then retry. Granola throttles at 25 req / 5s burst, 5 req/s sustained.',
      retryAfterSeconds: e.retryAfterSeconds,
    };
  }
  if (e instanceof GranolaServerError) {
    return {
      error: 'granola_server_error',
      message: e.message,
      hint: 'Granola returned 5xx after retries. Try again later; if persistent, escalate.',
    };
  }
  if (e instanceof GranolaNetworkError) {
    return {
      error: 'network_error',
      message: e.message,
      hint: 'Could not reach Granola. Check network; the plugin retries transient errors automatically.',
    };
  }
  if (e instanceof GranolaError) {
    return { error: 'granola_error', message: e.message };
  }
  if (e instanceof Error) {
    return { error: 'unknown_error', message: e.message };
  }
  return { error: 'unknown_error', message: String(e) };
}

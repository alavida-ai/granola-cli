/**
 * HTTP status → typed `GranolaError` mapping.
 *
 * Granola's API is read-only and exposes a small surface, so the mapping is
 * simpler than Attio's — no validation, permission, or gated errors.
 */

import {
  GranolaAuthError,
  GranolaError,
  type GranolaErrorBody,
  GranolaNotFoundError,
  GranolaRateLimitError,
  GranolaServerError,
} from './errors.js';
import { parseRetryAfterSeconds } from './http-helpers.js';

export function mapHttpError(
  status: number,
  body: GranolaErrorBody | string | undefined,
  requestId: string | undefined,
  headers: Headers,
): GranolaError {
  switch (status) {
    case 401:
      return new GranolaAuthError(body, requestId);
    case 404:
      return new GranolaNotFoundError(
        extractMessage(body) ?? 'Granola resource not found (404).',
        body,
        requestId,
      );
    case 429:
      return new GranolaRateLimitError(parseRetryAfterSeconds(headers), body, requestId);
    default:
      if (status >= 500 && status <= 599) {
        return new GranolaServerError(
          extractMessage(body) ?? `Granola server error (${status}).`,
          status,
          body,
          requestId,
        );
      }
      return new GranolaError(
        extractMessage(body) ?? `Granola request failed (${status}).`,
        status,
        body,
        requestId,
      );
  }
}

/** Best-effort message from a Granola error body. Probes `.message` then `.error`. */
function extractMessage(body: GranolaErrorBody | string | undefined): string | undefined {
  if (!body) return undefined;
  if (typeof body === 'string') return body;
  if (typeof body.message === 'string') return body.message;
  if (typeof body.error === 'string') return body.error;
  return undefined;
}

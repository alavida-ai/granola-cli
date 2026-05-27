/**
 * Output discipline for the CLI.
 *
 * Stdout = data. Stderr = human messages (status, errors, hints). Always.
 * Downstream tool calls consume stdout; mixing the two breaks piping.
 */

import {
  GranolaAuthError,
  GranolaError,
  GranolaNetworkError,
  GranolaNotFoundError,
  GranolaRateLimitError,
  GranolaServerError,
} from '@alavida-ai/granola-core';

/** Write a JSON payload to stdout, terminated with a newline. */
export function printJson(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

/** Write a line of text to stderr. */
export function eprintln(line = ''): void {
  process.stderr.write(line + '\n');
}

/** Write a line of text to stdout. */
export function println(line = ''): void {
  process.stdout.write(line + '\n');
}

/**
 * Format a thrown error as a one-line human message + suggested next step.
 *
 * Returns a string ready to print to stderr; the caller decides the exit code.
 */
export function formatError(e: unknown): string {
  if (e instanceof GranolaAuthError) {
    return (
      'Granola rejected the API key (401).\n' +
      '  Tell your operator: refresh GRANOLA_API_KEY. Generate a new key in the\n' +
      '  Granola desktop app: Settings → API → Create new key.'
    );
  }
  if (e instanceof GranolaNotFoundError) {
    return `Not found: ${e.message}`;
  }
  if (e instanceof GranolaRateLimitError) {
    const after =
      e.retryAfterSeconds !== undefined ? ` Retry after ${e.retryAfterSeconds}s.` : '';
    return `Rate-limited by Granola.${after}`;
  }
  if (e instanceof GranolaServerError) {
    return `Granola server error (${e.status}). Retries exhausted; try again later.`;
  }
  if (e instanceof GranolaNetworkError) {
    return `Network error reaching Granola: ${e.message}`;
  }
  if (e instanceof GranolaError) {
    return `Granola error (${e.status}): ${e.message}`;
  }
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
}

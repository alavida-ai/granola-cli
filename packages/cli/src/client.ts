/** Read GRANOLA_API_KEY from env, build a client, or exit 1 with a clear message. */
import { GranolaClient } from '@alavida-ai/granola-core';

import { eprintln } from './output.js';

/** Returns a built client or exits the process with code 1. */
export function getClient(): GranolaClient {
  const apiKey = (process.env.GRANOLA_API_KEY ?? '').trim();
  if (!apiKey) {
    eprintln('GRANOLA_API_KEY is not set.');
    eprintln(
      '  Export it in your shell or add it to your environment manager.\n' +
        '  Get the key from the Granola desktop app: Settings → API → Create new key.',
    );
    process.exit(1);
  }
  const baseUrl = process.env.GRANOLA_API_BASE?.trim();
  return new GranolaClient(baseUrl ? { apiKey, baseUrl } : { apiKey });
}

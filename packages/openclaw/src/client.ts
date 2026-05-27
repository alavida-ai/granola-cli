/**
 * Lazy {@link GranolaClient} singleton for the OpenClaw plugin.
 *
 * Constructed on first tool call, not at plugin bootstrap, so OpenClaw can
 * load the plugin even when `GRANOLA_API_KEY` is unset — the first call
 * surfaces a clean error instead of failing at startup.
 *
 * The cache invalidates if the resolved API key changes between calls.
 */
import { GranolaClient } from '@alavida-ai/granola-core';

/** Validated plugin config the gateway passes into tools. */
export interface PluginConfig {
  /** Granola API key. Falls back to GRANOLA_API_KEY env var. */
  granolaApiKey?: string;
}

let cachedClient: GranolaClient | null = null;
let cachedKey: string | null = null;

export function getClient(config: PluginConfig): GranolaClient {
  const key = config.granolaApiKey ?? process.env.GRANOLA_API_KEY ?? '';
  if (!key) {
    throw new Error(
      'granola plugin: GRANOLA_API_KEY is not configured. ' +
        'Set it via plugin config (granolaApiKey) or the GRANOLA_API_KEY env var. ' +
        'Get the key from the Granola desktop app: Settings → API → Create new key.',
    );
  }
  if (!cachedClient || cachedKey !== key) {
    cachedClient = new GranolaClient({ apiKey: key });
    cachedKey = key;
  }
  return cachedClient;
}

/** @internal — test-only. */
export function _resetClientForTesting(): void {
  cachedClient = null;
  cachedKey = null;
}

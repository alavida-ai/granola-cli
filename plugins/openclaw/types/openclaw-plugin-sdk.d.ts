/**
 * Minimal ambient stub for `openclaw/plugin-sdk` so this package can be
 * type-checked standalone, without the real OpenClaw SDK installed.
 *
 * The real SDK ships its own types and shadows this file at install time.
 * Keep this declaration narrow — only the surfaces this plugin uses.
 *
 * Source of truth: https://docs.openclaw.ai/plugins/building-plugins
 */
declare module "openclaw/plugin-sdk/plugin-entry" {
  /** Surface returned to a plugin's `register(api)` callback. */
  export interface OpenClawPluginApi {
    registerTool: (tool: unknown) => void;
    registerProvider: (provider: unknown) => void;
    [key: string]: unknown;
  }

  export interface PluginEntryOptions {
    id: string;
    name: string;
    description: string;
    kind?: string;
    configSchema?: unknown;
    register: (api: OpenClawPluginApi) => void;
  }

  export interface PluginEntry {
    plugin: PluginEntryOptions;
  }

  export function definePluginEntry(options: PluginEntryOptions): PluginEntry;
}

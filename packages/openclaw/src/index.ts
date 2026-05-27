/**
 * OpenClaw plugin entry — granola.
 *
 * Reads meeting notes, AI summaries, transcripts, and folders from Granola.ai.
 * Read-only — Granola's public API exposes no write endpoints.
 *
 * Architecture:
 *   - One file per tool in `./tools/<tool-name>.ts`, each default-exporting a
 *     {@link ToolDescriptor}.
 *   - {@link registerTool} wraps every descriptor with shared output/help
 *     injection, pretty/json dispatch, and `withErrorMapping`.
 */
import { Type } from 'typebox';
import { definePluginEntry } from 'openclaw/plugin-sdk/plugin-entry';

import type { PluginConfig } from './client.js';
import { readPluginConfig, registerTool, type ToolDescriptor } from './register.js';

import listNotes from './tools/list-notes.js';
import readNote from './tools/read-note.js';
import listFolders from './tools/list-folders.js';

const TOOLS: ToolDescriptor[] = [listNotes, readNote, listFolders];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const configJsonSchema: any = Type.Object({
  granolaApiKey: Type.Optional(
    Type.String({
      description: 'Granola API key (grn_...). Falls back to GRANOLA_API_KEY env var.',
    }),
  ),
});

export default definePluginEntry({
  id: 'granola',
  name: 'granola',
  description:
    "Read meeting notes, AI summaries, transcripts, and folders from Granola.ai. Read-only.",
  configSchema: { jsonSchema: configJsonSchema },
  register(api) {
    const getConfig = () => readPluginConfig(api);
    for (const tool of TOOLS) {
      registerTool(api, tool, getConfig);
    }
  },
});

export { getClient, _resetClientForTesting } from './client.js';
export type { PluginConfig };
export { withErrorMapping, isToolErrorEnvelope } from './errors.js';
export type { ToolErrorEnvelope, ToolErrorResponse } from './errors.js';
export { registerTool, defineTool, type ToolDescriptor } from './register.js';

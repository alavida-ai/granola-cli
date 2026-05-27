/**
 * Shared TypeBox schemas for the granola tool catalogue. Small surface — three
 * read-only tools — so this stays tiny.
 */
import { Type, type Static } from 'typebox';

/** Page size on cursor-paginated reads (1–30 — Granola's max). */
export const LimitSchema = Type.Optional(
  Type.Integer({
    minimum: 1,
    maximum: 30,
    description: 'Records per page (1–30, Granola API max). Default 30.',
  }),
);

/** Opaque pagination cursor — pass back verbatim from a previous response. */
export const PageTokenSchema = Type.Optional(
  Type.String({
    description: "Cursor from a previous response's cursor field. Opaque.",
  }),
);

/**
 * Shared output-mode toggle injected by `register.ts` into every tool's
 * parameter schema. Tool bodies never see it — the helper strips it before
 * dispatch and routes the result through the pretty or json renderer.
 */
export const OutputModeSchema = Type.Optional(
  Type.String({
    enum: ['pretty', 'json'] as const,
    default: 'pretty',
    description: "'pretty' (default) summary; 'json' raw payload for chaining.",
  }),
);
export type OutputMode = 'pretty' | 'json';

/**
 * Shared help toggle injected by `register.ts`. When `true`, the tool
 * short-circuits to the manpage. Equivalent of a CLI `--help` flag.
 */
export const HelpSchema = Type.Optional(
  Type.Boolean({
    description: 'Return usage docs instead of running. Like <cli> --help.',
  }),
);

/** Re-export Static for tool files. */
export type { Static };

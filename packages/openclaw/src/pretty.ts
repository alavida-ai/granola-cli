/**
 * Shape-detected pretty renderer for granola tool results.
 *
 * Three known shapes (notes list, single note, folders list) plus the error
 * envelope. Each renderer returns compact human/agent-readable text — the raw
 * payload is always available on `AgentToolResult.details` for chaining.
 */
import { isToolErrorEnvelope, type ToolErrorEnvelope } from './errors.js';

const SNIPPET_MAX = 120;

/** Render an arbitrary tool payload as compact text. */
export function renderPretty(payload: unknown): string {
  if (payload === undefined || payload === null) return '(no result)';

  if (isToolErrorEnvelope(payload)) {
    return renderError(payload);
  }

  if (isObject(payload)) {
    const p = payload as Record<string, unknown>;

    // list_notes — {notes, nextCursor, hasMore}
    if (Array.isArray(p.notes)) {
      return renderNoteList(p.notes as NoteShape[], {
        cursor: typeof p.nextCursor === 'string' ? p.nextCursor : null,
        hasMore: p.hasMore === true,
      });
    }
    // list_folders — {folders, nextCursor, hasMore}
    if (Array.isArray(p.folders)) {
      return renderFolderList(p.folders as FolderShape[], {
        cursor: typeof p.nextCursor === 'string' ? p.nextCursor : null,
        hasMore: p.hasMore === true,
      });
    }
    // read_note — single note (has `id` + `summary_markdown` or summary_text)
    if (typeof p.id === 'string' && ('summary_markdown' in p || 'summary_text' in p || 'title' in p)) {
      return renderSingleNote(p as NoteShape);
    }
  }

  // Generic fallback — JSON.stringify (truncated for readability).
  try {
    const text = JSON.stringify(payload, null, 2);
    return text.length > 4000 ? text.slice(0, 4000) + '\n…(truncated; use output: json)' : text;
  } catch {
    return String(payload);
  }
}

// ─── renderers ───────────────────────────────────────────────────────────────

interface NoteShape {
  id?: string;
  title?: string | null;
  owner?: { name?: string | null; email?: string | null };
  created_at?: string;
  updated_at?: string;
  summary_markdown?: string | null;
  summary_text?: string | null;
  folder_membership?: Array<{ id?: string; name?: string | null }>;
  transcript?: Array<{ speaker?: string | null; text?: string; start_time?: string }>;
}

interface FolderShape {
  id?: string;
  name?: string | null;
  parent_folder_id?: string | null;
}

interface PaginationFooter {
  cursor: string | null;
  hasMore: boolean;
}

function renderNoteList(notes: NoteShape[], page: PaginationFooter): string {
  if (notes.length === 0) return '(no notes)';
  const lines = notes.map((n) => {
    const id = n.id ?? '?';
    const title = n.title?.trim() || '(untitled)';
    const owner = n.owner?.email ?? '?';
    const created = n.created_at ?? '';
    return `  ${id}  ${created}  ${title}  <${owner}>`;
  });
  lines.unshift(`${notes.length} note${notes.length === 1 ? '' : 's'}:`);
  if (page.hasMore && page.cursor) {
    lines.push('');
    lines.push(`(more available — pass pageToken="${page.cursor}" to continue)`);
  }
  return lines.join('\n');
}

function renderSingleNote(n: NoteShape): string {
  const title = n.title?.trim() || '(untitled)';
  const lines: string[] = [
    title,
    `  id:      ${n.id ?? '?'}`,
    `  owner:   <${n.owner?.email ?? '?'}>`,
  ];
  if (n.created_at) lines.push(`  created: ${n.created_at}`);
  const folders = n.folder_membership ?? [];
  if (folders.length > 0) {
    lines.push(`  folders: ${folders.map((f) => f.name ?? f.id ?? '?').join(', ')}`);
  }
  lines.push('');

  const body = (n.summary_markdown ?? n.summary_text ?? '').trim();
  if (body) {
    lines.push(body.length > 2000 ? body.slice(0, 2000) + '\n…(truncated; use output: json)' : body);
  } else {
    lines.push('(no summary)');
  }

  if (Array.isArray(n.transcript) && n.transcript.length > 0) {
    lines.push('');
    lines.push(`── transcript (${n.transcript.length} segments) ──`);
    const sample = n.transcript.slice(0, 8);
    for (const seg of sample) {
      const speaker = seg.speaker ?? '?';
      const t = seg.start_time ?? '';
      const txt = (seg.text ?? '').replace(/\s+/g, ' ').trim();
      const snippet = txt.length > SNIPPET_MAX ? txt.slice(0, SNIPPET_MAX) + '…' : txt;
      lines.push(`  [${t}] ${speaker}: ${snippet}`);
    }
    if (n.transcript.length > sample.length) {
      lines.push(`  …(${n.transcript.length - sample.length} more segments; use output: json)`);
    }
  }
  return lines.join('\n');
}

function renderFolderList(folders: FolderShape[], page: PaginationFooter): string {
  if (folders.length === 0) return '(no folders)';
  const lines = folders.map((f) => {
    const parent = f.parent_folder_id ? `  (parent: ${f.parent_folder_id})` : '';
    return `  ${f.id ?? '?'}  ${f.name ?? '(unnamed)'}${parent}`;
  });
  lines.unshift(`${folders.length} folder${folders.length === 1 ? '' : 's'}:`);
  if (page.hasMore && page.cursor) {
    lines.push('');
    lines.push(`(more available — pass pageToken="${page.cursor}" to continue)`);
  }
  return lines.join('\n');
}

function renderError(envelope: ToolErrorEnvelope): string {
  const e = envelope.__toolError;
  const lines = [`✗ ${e.error}`, `  ${e.message}`];
  if (e.hint) lines.push(`  → ${e.hint}`);
  if (e.retryAfterSeconds !== undefined) lines.push(`  retry after: ${e.retryAfterSeconds}s`);
  return lines.join('\n');
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

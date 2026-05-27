import { parseArgs } from 'node:util';

import type { NoteSummary } from '@alavida-ai/granola-core';

import { getClient } from '../client.js';
import { eprintln, printJson, println } from '../output.js';

const HELP = `Usage: granola notes list [-n LIMIT] [--after DATE] [--before DATE]
                          [--updated-after DATE] [--cursor TOKEN] [--page-size N]
                          [--json]

List meeting notes, newest first.

Options:
  -n, --limit N         Total notes to return (default 10).
  --folder ID           Filer notes by parent folder ID, list folder endpoints to discover folder IDs
  --after DATE          Only notes created on/after this ISO-8601 date.
  --before DATE         Only notes created on/before this ISO-8601 date.
  --updated-after DATE  Only notes updated on/after this ISO-8601 date.
  --cursor TOKEN        Resume pagination from a cursor returned by a prior --json call.
                        When set, fetches a single page (no auto-pagination).
  --page-size N         API page size, max 30 (default 30).
  --json                Emit {results, count, cursor, hasMore} envelope.
  -h, --help            Show this help.
`;

interface ListEnvelope {
  results: NoteSummary[];
  count: number;
  cursor: string | null;
  hasMore: boolean;
}

export async function run(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      limit: { type: 'string', short: 'n' },
      folder: {type: 'string' },
      after: { type: 'string' },
      before: { type: 'string' },
      'updated-after': { type: 'string' },
      cursor: { type: 'string' },
      'page-size': { type: 'string' },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
    allowPositionals: false,
  });

  if (values.help) {
    process.stdout.write(HELP);
    return 0;
  }

  const limit = values.limit ? Number(values.limit) : 10;
  const pageSize = values['page-size'] ? Number(values['page-size']) : 30;
  if (!Number.isFinite(limit) || limit < 1) {
    eprintln('--limit must be a positive integer.');
    return 1;
  }
  if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > 30) {
    eprintln('--page-size must be between 1 and 30 (Granola API limit).');
    return 1;
  }

  const client = getClient();

  // If a cursor was passed explicitly, fetch one page and surface the envelope verbatim.
  if (values.cursor) {
    const page = await client.notes.list({
      cursor: values.cursor,
      pageSize,
      folderId: values.folder,
      createdAfter: values.after,
      createdBefore: values.before,
      updatedAfter: values['updated-after'],
    });
    const envelope: ListEnvelope = {
      results: page.notes,
      count: page.notes.length,
      cursor: page.cursor,
      hasMore: page.hasMore,
    };
    return emit(envelope, values.json);
  }

  // Otherwise auto-paginate up to limit.
  const results: NoteSummary[] = [];
  let lastCursor: string | null = null;
  let lastHasMore = false;
  for await (const note of client.notes.iterate({
    limit,
    pageSize,
    folderId: values.folder,
    createdAfter: values.after,
    createdBefore: values.before,
    updatedAfter: values['updated-after'],
  })) {
    results.push(note);
  }
  // Iterate() doesn't expose the final cursor; for `--json` consumers who want
  // to resume later, do a final page fetch with the last note's timestamp.
  // Simpler and sufficient for the dominant case: surface cursor=null + a
  // hasMore flag derived from whether we hit the limit.
  lastHasMore = results.length >= limit;

  const envelope: ListEnvelope = {
    results,
    count: results.length,
    cursor: lastCursor,
    hasMore: lastHasMore,
  };
  return emit(envelope, values.json);
}

function emit(envelope: ListEnvelope, asJson: boolean | undefined): number {
  if (asJson) {
    printJson(envelope);
    return 0;
  }
  if (envelope.results.length === 0) {
    eprintln('No notes found.');
    return 0;
  }
  for (const note of envelope.results) {
    const id = note.id;
    const title = note.title ?? '(untitled)';
    const owner = note.owner?.email ?? '?';
    const created = note.created_at ?? '';
    println(`${id}  ${created}  ${title}  <${owner}>`);
  }
  if (envelope.hasMore) {
    eprintln(`\n(${envelope.results.length} shown; more available — raise --limit or use --json + --cursor)`);
  }
  return 0;
}

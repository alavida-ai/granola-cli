import { parseArgs } from 'node:util';

import type { Folder } from '@alavida-ai/granola-core';

import { getClient } from '../client.js';
import { eprintln, printJson, println } from '../output.js';

const HELP = `Usage: granola folders list [-n LIMIT] [--cursor TOKEN] [--page-size N] [--json]

List folders.

Options:
  -n, --limit N    Total folders to return (default 100; folders are usually small).
  --cursor TOKEN   Resume pagination from a cursor (single page when set).
  --page-size N    API page size, max 30 (default 30).
  --json           Emit {results, count, cursor, hasMore} envelope.
  -h, --help       Show this help.
`;

interface ListEnvelope {
  results: Folder[];
  count: number;
  cursor: string | null;
  hasMore: boolean;
}

export async function run(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      limit: { type: 'string', short: 'n' },
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

  const limit = values.limit ? Number(values.limit) : 100;
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

  if (values.cursor) {
    const page = await client.folders.list({ cursor: values.cursor, pageSize });
    const envelope: ListEnvelope = {
      results: page.folders,
      count: page.folders.length,
      cursor: page.cursor,
      hasMore: page.hasMore,
    };
    return emit(envelope, values.json);
  }

  const results: Folder[] = [];
  for await (const folder of client.folders.iterate({ limit, pageSize })) {
    results.push(folder);
  }

  const envelope: ListEnvelope = {
    results,
    count: results.length,
    cursor: null,
    hasMore: results.length >= limit,
  };
  return emit(envelope, values.json);
}

function emit(envelope: ListEnvelope, asJson: boolean | undefined): number {
  if (asJson) {
    printJson(envelope);
    return 0;
  }
  if (envelope.results.length === 0) {
    eprintln('No folders found.');
    return 0;
  }
  for (const folder of envelope.results) {
    const parent = folder.parent_folder_id ? ` (parent: ${folder.parent_folder_id})` : '';
    println(`${folder.id}  ${folder.name ?? '(unnamed)'}${parent}`);
  }
  if (envelope.hasMore) {
    eprintln(`\n(${envelope.results.length} shown; more available — raise --limit)`);
  }
  return 0;
}

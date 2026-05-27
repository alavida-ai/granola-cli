import { parseArgs } from 'node:util';

import { getClient } from '../client.js';
import { eprintln, printJson, println } from '../output.js';

const HELP = `Usage: granola notes read NOTE_ID [--transcript] [--json]

Fetch a single note by id.

Arguments:
  NOTE_ID         Note id (pattern: not_<14 chars>). Get one from 'granola notes list'.

Options:
  --transcript    Include the full transcript (speaker + start/end times).
                  Without this flag, you get title, attendees, calendar metadata,
                  and the AI summary only.
  --json          Emit the full note object verbatim.
  -h, --help      Show this help.

The summary is always rendered as markdown (summary_markdown), falling back
to summary_text only if the note has no markdown version. The plaintext
field strips heading/list formatting; markdown preserves it.
`;

export async function run(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      transcript: { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
    allowPositionals: true,
  });

  if (values.help) {
    process.stdout.write(HELP);
    return 0;
  }

  const noteId = positionals[0];
  if (!noteId) {
    eprintln('Missing NOTE_ID. Run `granola notes read --help`.');
    return 1;
  }
  if (positionals.length > 1) {
    eprintln(`Unexpected extra arguments: ${positionals.slice(1).join(' ')}`);
    return 1;
  }

  const client = getClient();
  const note = await client.notes.get({ noteId, includeTranscript: values.transcript });

  if (values.json) {
    printJson(note);
    return 0;
  }

  // Human-readable: title + metadata header, then summary body.
  const title = note.title ?? '(untitled)';
  const owner = note.owner?.email ?? '?';
  const created = note.created_at ?? '';
  eprintln(`${title}`);
  eprintln(`  id:      ${note.id}`);
  eprintln(`  owner:   <${owner}>`);
  if (created) eprintln(`  created: ${created}`);
  const folders = note.folder_membership ?? [];
  if (folders.length > 0) {
    eprintln(`  folders: ${folders.map((f) => f.name ?? f.id).join(', ')}`);
  }
  eprintln('');

  // Always render markdown — preserves headings, bullets, emphasis. Fall back
  // to summary_text only if the note has no markdown version (rare).
  const body = note.summary_markdown ?? note.summary_text ?? '';
  println(body || '(no summary)');

  if (values.transcript && Array.isArray(note.transcript) && note.transcript.length > 0) {
    eprintln('');
    eprintln('── transcript ──');
    for (const seg of note.transcript) {
      const speaker = seg.speaker ?? '?';
      const t = seg.start_time ?? '';
      const text = seg.text ?? '';
      println(`[${t}] ${speaker}: ${text}`);
    }
  }
  return 0;
}

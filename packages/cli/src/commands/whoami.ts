import { parseArgs } from 'node:util';

import { inferIdentity } from '@alavida-ai/granola-core';

import { getClient } from '../client.js';
import { eprintln, printJson } from '../output.js';

const HELP = `Usage: granola whoami [--sample N] [--json]

Verify GRANOLA_API_KEY works and guess the calling user's identity.

Granola has no /me endpoint, so identity is inferred from the 'owner' field
across the last N notes (default 30). The most frequent owner is reported as
"likely you" — your own meetings should dominate, but personal keys also see
notes shared by collaborators, so the result is a probabilistic guess.

Options:
  --sample N    Notes to sample when guessing identity (default 30).
  --json        Emit JSON.
  -h, --help    Show this help.
`;

export async function run(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      sample: { type: 'string' },
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

  const sample = values.sample ? Number(values.sample) : 30;
  if (!Number.isFinite(sample) || sample < 1) {
    eprintln('--sample must be a positive integer.');
    return 1;
  }

  const client = getClient();
  const guess = await inferIdentity(client, sample);

  const payload = {
    authenticated: true,
    sample_size: guess.sampleSize,
    likely_you: guess.likelyYou
      ? { name: guess.likelyYou.name, email: guess.likelyYou.email, count: guess.likelyYou.count }
      : null,
    all_owners: guess.allOwners.map((o) => ({
      name: o.name,
      email: o.email,
      count: o.count,
    })),
  };

  if (values.json) {
    printJson(payload);
    return 0;
  }

  eprintln('API key is valid.');

  if (guess.sampleSize === 0) {
    eprintln('  No notes accessible — key works, but the workspace has no notes yet.');
    return 0;
  }

  if (guess.likelyYou) {
    eprintln(
      `  Likely you: ${guess.likelyYou.name ?? '?'} <${guess.likelyYou.email}> ` +
        `(${guess.likelyYou.count} of ${guess.sampleSize} recent notes)`,
    );
  }

  if (guess.allOwners.length > 1) {
    eprintln('');
    eprintln(
      `  All ${guess.allOwners.length} owners across last ${guess.sampleSize} notes ` +
        `(personal keys also see shared notes — pick the one that's actually you):`,
    );
    for (const o of guess.allOwners) {
      eprintln(`    ${String(o.count).padStart(3)}  ${(o.name ?? '?').padEnd(30)}  <${o.email}>`);
    }
  }
  return 0;
}

#!/usr/bin/env node
/**
 * granola — terminal CLI for the Granola public API.
 *
 *   granola whoami                            # verify key, guess identity
 *   granola notes list   [-n LIMIT] [...]     # list notes
 *   granola notes read   NOTE_ID  [...]       # one note + summary + transcript
 *   granola folders list [-n LIMIT] [...]     # list folders
 *
 * Stdout = data. Stderr = human messages. Exit 0 success, 1 user/auth error,
 * 2 unexpected error.
 *
 * No CLI framework dep — uses Node's util.parseArgs.
 */

import { eprintln, formatError } from './output.js';

const TOP_HELP = `Usage: granola <command> [args...]

Commands:
  whoami           Verify GRANOLA_API_KEY and guess the calling user's identity.
  notes list       List meeting notes, newest first.
  notes read ID    Fetch a single note (summary + optional transcript).
  folders list     List folders.

Run \`granola <command> --help\` for command-specific options.
Environment:
  GRANOLA_API_KEY     Required. Bearer token (grn_...).
  GRANOLA_API_BASE    Override the API host (default https://public-api.granola.ai).
`;

async function main(argv: string[]): Promise<number> {
  const [first, second, ...rest] = argv;

  if (!first || first === '--help' || first === '-h' || first === 'help') {
    process.stdout.write(TOP_HELP);
    return first ? 0 : 1;
  }

  if (first === 'whoami') {
    const { run } = await import('./commands/whoami.js');
    return run([second, ...rest].filter((v): v is string => v !== undefined));
  }

  if (first === 'notes') {
    if (second === 'list') {
      const { run } = await import('./commands/notes-list.js');
      return run(rest);
    }
    if (second === 'read') {
      const { run } = await import('./commands/notes-read.js');
      return run(rest);
    }
    eprintln(`Unknown notes subcommand: ${second ?? '(none)'}. Try \`granola notes list\` or \`granola notes read\`.`);
    return 1;
  }

  if (first === 'folders') {
    if (second === 'list') {
      const { run } = await import('./commands/folders-list.js');
      return run(rest);
    }
    eprintln(`Unknown folders subcommand: ${second ?? '(none)'}. Try \`granola folders list\`.`);
    return 1;
  }

  eprintln(`Unknown command: ${first}. Run \`granola --help\`.`);
  return 1;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    eprintln(formatError(err));
    process.exit(2);
  });

/**
 * `read_note` — fetch a single note by id with title, owner, AI summary, and
 * optionally the full transcript. Read-only.
 */
import { Type } from 'typebox';

import { getClient } from '../client.js';
import { defineTool } from '../register.js';

const readNote = defineTool({
  name: 'read_note',
  description:
    'Fetch a single meeting note: title, owner, AI summary (markdown), and optionally the full transcript. Use after list_notes. Read-only.',
  parameters: Type.Object({
    noteId: Type.String({
      description: 'Note id (pattern: not_<14 chars>). Get one from list_notes.',
    }),
    includeTranscript: Type.Optional(
      Type.Boolean({
        default: false,
        description:
          'Include the full transcript (speaker + start/end times). Off by default to save context. The summary is always returned.',
      }),
    ),
  }),
  async execute({ noteId, includeTranscript }, config) {
    const client = getClient(config);
    return client.notes.get({ noteId, includeTranscript: includeTranscript === true });
  },
});

export default readNote;

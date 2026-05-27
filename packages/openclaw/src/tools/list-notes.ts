/**
 * `list_notes` — meeting notes, newest first. Read-only.
 *
 * Returns compact headlines (id, title, owner, created_at). Use `read_note`
 * for the full body or transcript.
 */
import { Type } from 'typebox';

import { getClient } from '../client.js';
import { defineTool } from '../register.js';
import { LimitSchema, PageTokenSchema } from '../shared-schemas.js';

interface NoteHeadline {
  id: string;
  title: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

const listNotes = defineTool({
  name: 'list_notes',
  description:
    'List meeting notes, newest first. Returns headlines (id, title, owner, created_at). Use read_note for the full summary or transcript. Read-only.',
  parameters: Type.Object({
    limit: LimitSchema,
    pageToken: PageTokenSchema,
    folderId: Type.Optional(
      Type.String({ description: 'Filer notes by parent folder ID, list folder endpoints to discover folder IDs'}),
    ),
    createdAfter: Type.Optional(
      Type.String({ description: 'ISO-8601 — only notes created on/after this timestamp.' }),
    ),
    createdBefore: Type.Optional(
      Type.String({ description: 'ISO-8601 — only notes created on/before this timestamp.' }),
    ),
    updatedAfter: Type.Optional(
      Type.String({ description: 'ISO-8601 — only notes whose updated_at is on/after this timestamp.' }),
    ),
  }),
  async execute(params, config) {
    const client = getClient(config);
    const page = await client.notes.list({
      pageSize: params.limit,
      cursor: params.pageToken,
      folderId: params.folderId,
      createdAfter: params.createdAfter,
      createdBefore: params.createdBefore,
      updatedAfter: params.updatedAfter,
    });
    const notes: NoteHeadline[] = page.notes.map((n) => ({
      id: n.id,
      title: typeof n.title === 'string' ? n.title : null,
      ownerName: n.owner?.name ?? null,
      ownerEmail: n.owner?.email ?? null,
      createdAt: n.created_at ?? null,
      updatedAt: n.updated_at ?? null,
    }));
    return {
      notes,
      nextCursor: page.cursor,
      hasMore: page.hasMore,
    };
  },
});

export default listNotes;

/**
 * The Granola SDK entry point.
 *
 * One instance per API key. The whole API surface is three GET endpoints, so
 * the client exposes them directly as `notes.list`, `notes.get`, `folders.list`.
 *
 * @example
 * ```ts
 * const client = new GranolaClient({ apiKey: process.env.GRANOLA_API_KEY! });
 * const page = await client.notes.list({ pageSize: 10 });
 * const note = await client.notes.get({ noteId: page.notes[0].id, includeTranscript: true });
 * ```
 */
import { type GranolaClientConfig, resolveConfig } from './config.js';
import { createTransport, type RequestFn } from './transport.js';
import type { Folder, FoldersPage, Note, NoteSummary, NotesPage } from './types.js';

export interface ListNotesParams {
  /** Page size (1–30 per Granola API limits). */
  pageSize?: number;
  /** Cursor from a previous response. Opaque. */
  cursor?: string;
  /** ISO-8601 — only notes created on/after this timestamp. */
  createdAfter?: string;
  /** ISO-8601 — only notes created on/before this timestamp. */
  createdBefore?: string;
  /** ISO-8601 — only notes whose `updated_at` is on/after this timestamp. */
  updatedAfter?: string;
  /** ^fol_[a-zA-Z0-9]{14}$ pattern */
  folderId?: string;
}

export interface GetNoteParams {
  noteId: string;
  /** Include the transcript array. Otherwise the note is returned without it. */
  includeTranscript?: boolean;
}

export interface ListFoldersParams {
  pageSize?: number;
  cursor?: string;
}

export interface NotesResource {
  /** One page of notes. */
  list(params?: ListNotesParams): Promise<NotesPage>;
  /** Iterate notes across pages, stopping at `limit` if set. */
  iterate(params?: ListNotesParams & { limit?: number }): AsyncIterable<NoteSummary>;
  /** Fetch a single note. */
  get(params: GetNoteParams): Promise<Note>;
}

export interface FoldersResource {
  list(params?: ListFoldersParams): Promise<FoldersPage>;
  iterate(params?: ListFoldersParams & { limit?: number }): AsyncIterable<Folder>;
}

export class GranolaClient {
  readonly notes: NotesResource;
  readonly folders: FoldersResource;

  constructor(config: GranolaClientConfig) {
    const resolved = resolveConfig(config);
    const request = createTransport(resolved);
    this.notes = createNotes(request);
    this.folders = createFolders(request);
  }
}

// ─── resources ───────────────────────────────────────────────────────────────

function createNotes(request: RequestFn): NotesResource {
  async function list(params: ListNotesParams = {}): Promise<NotesPage> {
    const raw = await request<Record<string, unknown>>({
      method: 'GET',
      path: '/v1/notes',
      query: {
        page_size: params.pageSize,
        cursor: params.cursor,
        created_after: params.createdAfter,
        created_before: params.createdBefore,
        updated_after: params.updatedAfter,
        folder_id: params.folderId
      },
    });
    return {
      notes: Array.isArray(raw.notes) ? (raw.notes as NoteSummary[]) : [],
      hasMore: raw.hasMore === true,
      cursor: typeof raw.cursor === 'string' ? raw.cursor : null,
    };
  }

  return {
    list,
    async *iterate(params: ListNotesParams & { limit?: number } = {}) {
      const { limit, ...rest } = params;
      let cursor = rest.cursor;
      let yielded = 0;
      for (;;) {
        const page = await list({ ...rest, cursor });
        for (const note of page.notes) {
          yield note;
          yielded += 1;
          if (limit !== undefined && yielded >= limit) return;
        }
        if (!page.hasMore || !page.cursor) return;
        cursor = page.cursor;
      }
    },
    async get({ noteId, includeTranscript }: GetNoteParams): Promise<Note> {
      return request<Note>({
        method: 'GET',
        path: `/v1/notes/${encodeURIComponent(noteId)}`,
        query: includeTranscript ? { include: 'transcript' } : undefined,
      });
    },
  };
}

function createFolders(request: RequestFn): FoldersResource {
  async function list(params: ListFoldersParams = {}): Promise<FoldersPage> {
    const raw = await request<Record<string, unknown>>({
      method: 'GET',
      path: '/v1/folders',
      query: { page_size: params.pageSize, cursor: params.cursor },
    });
    return {
      folders: Array.isArray(raw.folders) ? (raw.folders as Folder[]) : [],
      hasMore: raw.hasMore === true,
      cursor: typeof raw.cursor === 'string' ? raw.cursor : null,
    };
  }

  return {
    list,
    async *iterate(params: ListFoldersParams & { limit?: number } = {}) {
      const { limit, ...rest } = params;
      let cursor = rest.cursor;
      let yielded = 0;
      for (;;) {
        const page = await list({ ...rest, cursor });
        for (const folder of page.folders) {
          yield folder;
          yielded += 1;
          if (limit !== undefined && yielded >= limit) return;
        }
        if (!page.hasMore || !page.cursor) return;
        cursor = page.cursor;
      }
    },
  };
}

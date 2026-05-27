/**
 * Wire shapes returned by the Granola public API.
 *
 * Types reflect what we observe today; fields are optional where Granola is
 * known to omit them. Unknown extra fields pass through via the index signature.
 */

/** Owner of a note — usually the user who attended the meeting. */
export interface NoteOwner {
  name?: string | null;
  email?: string | null;
  [k: string]: unknown;
}

/** Summary shape returned in `GET /v1/notes` results. */
export interface NoteSummary {
  id: string;
  title?: string | null;
  owner?: NoteOwner;
  created_at?: string;
  updated_at?: string;
  [k: string]: unknown;
}

/** Transcript segment returned when `include=transcript` is passed. */
export interface TranscriptSegment {
  speaker?: string | null;
  text?: string;
  start_time?: string;
  end_time?: string;
  [k: string]: unknown;
}

/** Folder membership row returned on each note. A note can belong to many folders. */
export interface FolderMembership {
  id: string;
  name?: string | null;
  parent_folder_id?: string | null;
  [k: string]: unknown;
}

/** Detail shape returned in `GET /v1/notes/{id}`. */
export interface Note extends NoteSummary {
  web_url?: string | null;
  summary_markdown?: string | null;
  summary_text?: string | null;
  attendees?: unknown[];
  calendar_event?: unknown;
  folder_membership?: FolderMembership[];
  transcript?: TranscriptSegment[];
}

/** Folder shape returned in `GET /v1/folders`. */
export interface Folder {
  id: string;
  name?: string | null;
  parent_folder_id?: string | null;
  created_at?: string;
  updated_at?: string;
  [k: string]: unknown;
}

/** Cursor-paginated envelope used by every list endpoint. */
export interface PageEnvelope<T> {
  hasMore?: boolean;
  cursor?: string | null;
  [k: string]: unknown;
  // Item array key varies by endpoint (`notes`, `folders`); resource methods
  // surface the items explicitly so callers don't need to know the wire key.
  // Untyped index signature above tolerates the wire field for `passthrough`.
  // The typed item array is materialised in resource return types.
  items?: T[];
}

/** Result of `notes.list()` — items + nextPageToken. */
export interface NotesPage {
  notes: NoteSummary[];
  hasMore: boolean;
  cursor: string | null;
}

/** Result of `folders.list()` — items + nextPageToken. */
export interface FoldersPage {
  folders: Folder[];
  hasMore: boolean;
  cursor: string | null;
}

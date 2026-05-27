export { GranolaClient } from './client.js';
export type {
  ListNotesParams,
  ListFoldersParams,
  GetNoteParams,
  NotesResource,
  FoldersResource,
} from './client.js';

export type { GranolaClientConfig, ResolvedGranolaClientConfig } from './config.js';
export { DEFAULT_BASE_URL, resolveConfig } from './config.js';

export {
  GranolaError,
  GranolaAuthError,
  GranolaNotFoundError,
  GranolaRateLimitError,
  GranolaServerError,
  GranolaNetworkError,
} from './errors.js';
export type { GranolaErrorBody } from './errors.js';

export type {
  Note,
  NoteOwner,
  NoteSummary,
  NotesPage,
  Folder,
  FolderMembership,
  FoldersPage,
  TranscriptSegment,
} from './types.js';

export { inferIdentity } from './whoami.js';
export type { IdentityGuess, OwnerCount } from './whoami.js';

/**
 * `list_folders` — folders the user has organised notes into.
 *
 * Each folder has `id`, `name`, optional `parent_folder_id` (nested folders).
 * Read-only.
 */
import { Type } from 'typebox';

import { getClient } from '../client.js';
import { defineTool } from '../register.js';
import { LimitSchema, PageTokenSchema } from '../shared-schemas.js';

const listFolders = defineTool({
  name: 'list_folders',
  description:
    'List folders the user has organised notes into. Each folder has id, name, and optional parent_folder_id (nested folders). Read-only.',
  parameters: Type.Object({
    limit: LimitSchema,
    pageToken: PageTokenSchema,
  }),
  async execute(params, config) {
    const client = getClient(config);
    const page = await client.folders.list({
      pageSize: params.limit,
      cursor: params.pageToken,
    });
    return {
      folders: page.folders,
      nextCursor: page.cursor,
      hasMore: page.hasMore,
    };
  },
});

export default listFolders;

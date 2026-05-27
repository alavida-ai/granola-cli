# @alavida-ai/granola-core

## 0.2.0

### Minor Changes

- ad82d18: Add folder_id query filter to list-notes endpoint. Lets agents and CLI users narrow a notes query by folder without client-side filtering, which is wasteful when the user knows the folder up front. Wire-level param is folder_id; surfaced as --folder in the CLI and folderId in the openclaw tool.

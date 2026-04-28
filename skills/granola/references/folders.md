# Folders

Granola organises notes into folders (and nested sub-folders via `parent_folder_id`). The CLI exposes one read-only command.

## List folders

```bash
granola folders list [-n LIMIT] [--page-size N] [--json] [--select fields]
```

- **Default:** up to 100 folders. The CLI auto-paginates the API (max 30 per page).
- **`--json`** — emit `{"results": [...], "count": N, "cursor": "...", "hasMore": bool}`.
- **`--select id,name,parent_folder_id`** — projection.

## Folder fields

```json
{
  "id":               "fol_abcdefghijklmn",
  "name":             "Customer calls",
  "parent_folder_id": "fol_xxxxxxxxxxxxxx"   // null for top-level folders
}
```

## Building the hierarchy client-side

The API returns folders as a flat list. To reconstruct the tree:

```bash
granola folders list -n 1000 --json \
  | jq '
    .results as $all
    | $all
    | map(select(.parent_folder_id == null))
    | map(. + {children: [$all[] | select(.parent_folder_id == .id)]})
  '
```

## Cross-referencing notes and folders

`granola notes read` returns `folder_membership` on each note — that's the canonical mapping. Granola folders are tags-like (a note can be in multiple folders), not directories.

# Folders

Granola organises notes into folders (and nested sub-folders via `parent_folder_id`). The CLI exposes one read-only command.

## List folders

```bash
granola folders list [-n LIMIT] [--cursor TOKEN] [--page-size N] [--json]
```

- **Default:** up to 100 folders. The CLI auto-paginates the API (max 30 per page).
- **`-n / --limit`** — cap the total folders returned.
- **`--cursor TOKEN`** — resume pagination from a prior `--json` envelope.
- **`--json`** — emit `{"results": [...], "count": N, "cursor": "...", "hasMore": bool}`.

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

A note's `folder_membership` (returned by `granola notes read --json`) is the canonical mapping — it's an array because Granola folders are tag-like, not directories. A note can belong to multiple folders.

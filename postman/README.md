# Postman collection — Granola API

A Postman collection that mirrors every endpoint `@alavida-ai/granola-core` uses. Granola's public API is small — three GET endpoints — so the collection is short but exercises every shape (pagination, date filters, `include=transcript`, cursor-driven resumes).

## Import

1. Open Postman → **File → Import**
2. Drop `granola.postman_collection.json` in
3. The collection appears as **"Granola API"** in the sidebar

## Configure

The collection uses **collection variables** (not environments) so everything is self-contained:

1. Right-click the collection → **Edit** → **Variables** tab
2. Set the **current value** of `GRANOLA_API_KEY` to your personal key (`grn_…`). Generate one in the Granola desktop app: **Settings → API → Create new key**.
3. Optionally pre-fill `NOTE_ID` after running `Notes → List notes (basic)` — pick an `id` from the response.
4. Save.

The Bearer auth is set at the collection root — every request inherits it.

## Folders / endpoints

| Folder | Endpoints | Safe? |
|---|---|---|
| 1. Notes | `GET /v1/notes` (4 variants), `GET /v1/notes/{id}` (with + without transcript) | read-only |
| 2. Folders | `GET /v1/folders` (basic + cursor) | read-only |
| 3. Identity (no /me) | sample `GET /v1/notes?page_size=30` for owner inference | read-only |

Everything is read-only. Granola's public API exposes no write endpoints.

## Typical usage flow

1. `Notes → List notes (basic)` → confirm your key + see the 10 most recent notes
2. Copy a `note_id` from the response into the `NOTE_ID` collection variable
3. `Notes → Read note` → drill into one (summary only)
4. `Notes → Read note + transcript` → same note with the full transcript array
5. `Folders → List folders` → see folder hierarchy
6. `Identity → Infer identity (sample 30)` → poor-man's whoami by tallying `owner.email` across the page

## How this maps to the SDK

Every request lists the SDK method in its description, e.g.:

> Used by SDK's `client.notes.list({ pageSize, createdAfter })`.

So you can compare what Postman sends against what the SDK sends and what each returns. Useful when verifying the SDK's camelCase ↔ snake_case mapping (`pageSize` → `page_size`, `createdAfter` → `created_after`).

## Things to know

- **`include=transcript` is opt-in.** Without it, `GET /v1/notes/{id}` returns title, attendees, calendar metadata, AI summary, and `folder_membership` — but no transcript. The transcript can be large.
- **No search endpoint.** No `q=`, no `query` field. To find "notes about X", page through `GET /v1/notes` with `created_after=…` and filter client-side.
- **No `/me` endpoint.** "Who am I?" is inferred from the most frequent `owner.email` across recent notes. Personal keys see notes shared by collaborators, so the result is a probabilistic guess. The `Identity` folder demonstrates this.
- **Folders are tag-like, not directories.** A note can belong to multiple folders (see `folder_membership` on `GET /v1/notes/{id}`). `GET /v1/folders` returns the catalog; the relationship lives on the note.
- **Pagination is cursor-based, max `page_size=30`.** Each response contains `hasMore: bool` and `cursor: string | null`. Pass the cursor back to fetch the next page.
- **Rate limits.** 25 req / 5s burst, 5 req/s sustained. 429 includes `Retry-After`.

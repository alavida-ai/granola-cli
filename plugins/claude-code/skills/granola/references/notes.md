# Notes

The Granola API exposes meeting notes via two endpoints: `GET /v1/notes` (list) and `GET /v1/notes/{id}` (single note + optional transcript). Read-only.

## List notes

```bash
granola notes list [-n LIMIT] [--after DATE] [--before DATE] [--updated-after DATE]
                   [--cursor TOKEN] [--page-size N] [--json]
```

- **Default:** 10 most recent notes, newest first.
- **`-n / --limit`** — total notes to return. The CLI auto-paginates the API (max 30 per page) until the limit is hit.
- **`--after YYYY-MM-DD`** — only notes created on/after this date. Combine with `--before` for date ranges.
- **`--updated-after YYYY-MM-DD`** — only notes whose `updated_at` is on/after this date. Useful for incremental syncs.
- **`--cursor TOKEN`** — resume pagination from a cursor returned in a prior `--json` envelope. When set, fetches a single page (no auto-pagination).
- **`--json`** — emit `{"results": [...], "count": N, "cursor": "...", "hasMore": bool}`.

## NoteSummary fields (list output, JSON shape)

```json
{
  "id":         "not_1d3tmYTlCICgjy",
  "title":      "Weekly sync — engineering",
  "owner":      { "name": "Alex", "email": "alex@alavida.ai" },
  "created_at": "2026-04-27T15:30:00Z",
  "updated_at": "2026-04-27T16:12:11Z"
}
```

## Read a single note

```bash
granola notes read NOTE_ID [--transcript] [--json]
```

- **NOTE_ID** — pattern `not_<14 chars>`. Get one from `granola notes list`.
- **`--transcript`** — include the full transcript (speaker + start/end times). Without this flag, you get the title, attendees, calendar event metadata, and the AI summary only.
- **`--json`** — emit the full note object verbatim (both `summary_markdown` and `summary_text` available).

The pretty (non-`--json`) summary is always rendered from `summary_markdown` — that preserves headings, bullets, and emphasis. If a note has no markdown version (rare), the CLI falls back to `summary_text`. Use `--json` if you need raw plaintext.

### Note object fields (read output, JSON shape)

| Field | Notes |
|-------|-------|
| `id` | `not_<14 chars>` |
| `title` | string \| null |
| `owner` | `{name, email}` |
| `created_at`, `updated_at` | ISO 8601 |
| `web_url` | direct link to the note in the Granola web app |
| `calendar_event` | `{title, invitees, organizer, id, start_time, end_time}` \| null |
| `attendees` | `[{name, email}, ...]` |
| `folder_membership` | `[{id, name, parent_folder_id}, ...]` — Granola folders are tag-like; a note can belong to multiple |
| `summary_text` | plain-text summary |
| `summary_markdown` | markdown-formatted summary (or null) |
| `transcript` | `[{speaker, text, start_time, end_time}, ...]` — only when `--transcript` |

### Speaker labels: what Granola actually exposes

Granola's per-speaker behavior depends on which app recorded the note. From [their own help docs](https://docs.granola.ai/help-center/taking-notes/transcription#can-granola-recognize-different-speakers):

| Recording source | What you get |
|---|---|
| **Desktop (macOS/Windows)** | No real diarization (real-time transcription models don't support it). Only `source: "microphone" \| "speaker"` — i.e. "Me vs Them" via audio channel. |
| **iPhone app, face-to-face meeting** | **Real per-person diarization.** `speaker.diarization_label` populated with speaker labels. |
| **iPhone app, virtual call** | Unclear from docs — likely Me/Them only. |

The two channel-level sources for desktop recordings:

| `speaker.source` | Granola UI bubble | Meaning |
|---|---|---|
| `microphone` | green (right) | your mic input |
| `speaker` | grey (left) | system audio — everyone else, merged |

### Implications for "who said what" questions

When the user asks "what did Greg say about pricing":

1. **iPhone-recorded face-to-face mtg** → diarization labels are reliable; use them.
2. **Desktop virtual meeting, 2 people** → `Them:` is reliably the other person.
3. **Desktop virtual meeting, 3+ attendees** → `Them:` is a merged stream of all of them. You cannot attribute lines to specific people. Say so.
4. **Desktop in-person meeting** → unattributed plain text. You cannot tell who said anything.

In ambiguous cases (3 and 4), prefer the AI summary (`summary_markdown`) — Granola's summarizer often paraphrases attendees by name in bullets even though the raw transcript can't be attributed.

## Pagination patterns

**Drain everything since a date (auto-paginated):**

```bash
granola notes list --after 2026-04-01 -n 1000 --json | jq '.count'
```

**Manual pagination (e.g. saving state between invocations):**

```bash
PAGE=$(granola notes list --json --page-size 30)
echo "$PAGE" | jq '.results'
NEXT=$(echo "$PAGE" | jq -r '.cursor // empty')
[ -n "$NEXT" ] && granola notes list --json --cursor "$NEXT"
```

## "Search" patterns (no native search endpoint)

Granola's API does not expose search. Filter client-side on a recent slice:

```bash
# Notes whose title contains "review"
granola notes list --after 2026-04-01 -n 200 --json \
  | jq -r '.results[] | select(.title | test("review"; "i")) | .id'

# Notes with a specific attendee
granola notes list -n 100 --json \
  | jq -r '.results[].id' \
  | xargs -I{} granola notes read {} --json \
  | jq -r 'select(.attendees[]?.email == "alex@alavida.ai") | .id'
```

Pre-filter with `--after` aggressively. Iterating thousands of notes to find one is wasteful; ask the user when the meeting was if they don't say.

## Common chains

```bash
# Markdown summary of yesterday's meetings, suitable for a daily digest
granola notes list --after $(date -v-1d +%Y-%m-%d) -n 20 --json \
  | jq -r '.results[].id' \
  | while read -r id; do granola notes read "$id"; echo; done

# Action items: read the markdown summary and let the LLM extract them
granola notes read NOTE_ID

# Pull the transcript only
granola notes read NOTE_ID --transcript --json | jq '.transcript'
```

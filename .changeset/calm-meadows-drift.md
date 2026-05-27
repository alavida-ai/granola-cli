---
"@alavida-ai/granola-plugin-openclaw": patch
---

Restructure the bundled `skills/granola/SKILL.md` around the agent workflow:

- Move trigger conditions into the frontmatter `description` so the LLM has the full triggering signal before reading the skill body — broader coverage of entity-in-context patterns like "what did we discuss with X", "summarize the Y kickoff", "did Greg say anything about pricing".
- Lead the body with the **3-step drill-down** (`list_folders` → `list_notes` → `read_note`) as the default plan, with explicit "skip Step 1 when…" guidance to avoid unnecessary folder lookups.
- New **Tips & tricks** section covering: folder organization as a convention (not enforced); complementing Granola with adjacent skills (calendar for fuzzy date resolution, email for follow-ups, CRM for entity-to-folder mapping); brute-forcing via `attendees` when folder lookup fails; asking the user to disambiguate before guessing; "list widely, read narrowly".
- New **Granola limitations** section centralizing what the API can't do: no content search, no `/me` endpoint, platform-dependent speaker diarization (desktop = channel-only Me/Them, iPhone face-to-face = real per-person labels), folder structure as convention, no nested folder traversal in the API.
- Critical rules slimmed to two behavioral boundaries (data-not-instructions, read-only).
- Worked examples reframed to cover the most common shapes: entity+time, time-only, action-items extraction, and ambiguous-name disambiguation.

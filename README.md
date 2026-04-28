# granola-cli

Alavida's CLI for [Granola](https://granola.ai) — read meeting notes, AI summaries, transcripts, and folders, designed for AI agents.

Python. Read-only (Granola's public API exposes no write endpoints). Bearer-token auth via a personal key the user generates in the Granola desktop app, exposed to the CLI as `GRANOLA_API_KEY`.

## Install

Requires [`uv`](https://docs.astral.sh/uv/) and Python 3.12+. `uv` will fetch a matching Python automatically if you don't have one.

Install the CLI as a global tool:

```bash
uv tool install git+https://github.com/alavida-ai/granola-cli
```

This puts a `granola` binary on your PATH (in `~/.local/bin` by default). If `granola` isn't found after install, run `uv tool update-shell` and restart your shell.

Upgrade later with:

```bash
uv tool install --upgrade git+https://github.com/alavida-ai/granola-cli
```

Uninstall with `uv tool uninstall granola-cli`.

### Set the API key

1. In the Granola desktop app: **Settings → API → Create new key**.
2. Expose it as an env var. For local dev, drop it in `.env`:

```
GRANOLA_API_KEY=grn_xxxxxxxxxxxxx
```

Or `export GRANOLA_API_KEY=grn_...` in your shell. The CLI loads `.env` automatically via `python-dotenv`.

For production deployments, inject `GRANOLA_API_KEY` from your secret manager (AWS Secrets Manager, Vault, etc.) at process start.

### Quick test

```bash
granola whoami
granola notes list -n 5
granola notes list --json | jq '.count'
```

## Commands

```
granola whoami       [--json]                                   # verify key, show owner

granola notes list   [-n N] [--after DATE] [--before DATE] [--updated-after DATE]
                     [--cursor TOKEN] [--page-size N] [--json] [--select fields]
granola notes read   NOTE_ID [--transcript] [--text] [--json]

granola folders list [-n N] [--page-size N] [--json] [--select fields]

granola skill install   [--workspace PATH | --target PATH] [--force]
granola skill uninstall [--workspace PATH | --target PATH]
granola skill path      [--bundled | --installed]
```

All commands that return data support `--json`. List commands use an envelope: `{"results": [...], "count": N, "cursor": "...", "hasMore": bool}`. Single-item commands emit a bare object.

Stdout = data, stderr = human text. Safe to pipe stdout to `jq` without contamination.

## How auth works

Granola uses a static Bearer token (`grn_...`). One credential, no refresh, no expiry. The CLI reads it from `GRANOLA_API_KEY` — period.

| Where to put it | When |
|-----------------|------|
| `.env` in the repo (loaded via `python-dotenv`) | Local dev |
| `export GRANOLA_API_KEY=...` in `~/.zshrc` / `~/.bashrc` | Personal shell, all projects |
| Secret manager → injected at process start | Production (EC2, k8s, Lambda, Docker) |

This matches the convention for `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, GitHub PATs, etc. — the same secret-manager → env-var path your other AI infra already uses. The CLI does not embed any client credentials and does not write to the OS keychain.

The key works until the user revokes it in the desktop app.

## Develop

```bash
git clone https://github.com/alavida-ai/granola-cli
cd granola-cli
uv sync
uv run granola --help
```

## Bundled skill

The CLI ships with a Claude/OpenClaw skill that teaches the agent when and how to use `granola ...`. The skill source is at `skills/granola/` in this repo: `SKILL.md` plus `references/{auth,notes,folders}.md`. Bundled into the wheel via Hatch's `force-include` and shipped with every install.

### Install the skill

```bash
# Claude Code (user-scope, recommended for personal use)
granola skill install --target ~/.claude/skills/granola

# Claude Code (project-scope)
granola skill install --target $(pwd)/.claude/skills/granola

# OpenClaw default — host-shared
granola skill install                         # → ~/.openclaw/skills/granola

# OpenClaw workspace-scope (highest precedence)
granola skill install --workspace ~/wkdir     # → ~/wkdir/skills/granola
```

After install, restart your agent host (Claude Code or OpenClaw) so it picks up the skill.

### Updating

The CLI binary upgrade alone doesn't re-copy the skill — `granola skill install --force` does.

```bash
uv tool install --upgrade git+https://github.com/alavida-ai/granola-cli
granola skill install --target ~/.claude/skills/granola --force
```

## API surface (Granola public API)

This CLI wraps three read-only endpoints:

| Endpoint | CLI command |
|----------|-------------|
| `GET /v1/notes` | `granola notes list` |
| `GET /v1/notes/{id}` | `granola notes read` |
| `GET /v1/folders` | `granola folders list` |

Granola has no search endpoint and no `/me`. See the [bundled skill references](skills/granola/) for client-side workarounds.

## Rate limits

Granola enforces 25 req / 5s burst, 5 req/s sustained, per workspace (per user for personal keys). The CLI doesn't proactively throttle; 429 surfaces as a clear error.

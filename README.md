# granola-plugin

Alavida's Granola integration — a CLI for [Granola](https://granola.ai) — read meeting notes, AI summaries, transcripts, and folders, designed for AI agents.

Python. Read-only (Granola's public API exposes no write endpoints). Bearer-token auth via a personal key the user generates in the Granola desktop app, exposed to the CLI as `GRANOLA_API_KEY`.

## Install

Requires [`uv`](https://docs.astral.sh/uv/) and Python 3.12+. `uv` will fetch a matching Python automatically if you don't have one.

Install the CLI as a global tool:

```bash
uv tool install git+https://github.com/alavida-ai/granola-plugin
```

This puts a `granola` binary on your PATH (in `~/.local/bin` by default). If `granola` isn't found after install, run `uv tool update-shell` and restart your shell.

Upgrade later with:

```bash
uv tool install --upgrade git+https://github.com/alavida-ai/granola-plugin
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

## OpenClaw deployment

The bundled skill declares `GRANOLA_API_KEY` in its OpenClaw metadata (`requires.env` for load-time gating, `primaryEnv` to mark it as the skill's primary credential). OpenClaw will skip-load the skill if the key isn't reachable.

The credential gets wired in via `~/.openclaw/openclaw.json` under `skills.entries.granola.apiKey`. Pick the shape based on threat model — personal vs production.

### Personal / single-operator (plaintext)

For your own VPS or laptop where you're the only operator, inline the key directly. The plaintext-on-disk risk is identical to a `.env` and the simplicity is worth it:

```json5
{
  skills: {
    entries: {
      granola: {
        enabled: true,
        apiKey: "grn_xxxxxxxxxxxxx"
      }
    }
  }
}
```

```bash
chmod 600 ~/.openclaw/openclaw.json    # owner-only read/write — no other user on the box can read the file
openclaw gateway restart               # gateway reloads ~/.openclaw/openclaw.json on restart
openclaw skills list                   # confirm 'granola' is loaded
```

`chmod 600` sets Unix permissions to `rw-------` — only the file's owner can read or write it. Default is usually `644` (`rw-r--r--`, world-readable). Locking down config files that hold secrets is standard hygiene on any multi-user host.

### Production / client work (SecretRef)

For deployments where the secret should live in a real secret manager (AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault, Fly secrets, etc.) and never in plaintext on disk, use the SecretRef form:

```json5
{
  skills: {
    entries: {
      granola: {
        enabled: true,
        apiKey: { source: "env", provider: "default", id: "GRANOLA_API_KEY" }
      }
    }
  }
}
```

This tells OpenClaw to read `GRANOLA_API_KEY` from its own process environment at runtime — `openclaw.json` itself never holds the secret. The actual value comes from your deployment's standard secret-injection path:

| Deployment | Inject `GRANOLA_API_KEY` via |
|---|---|
| systemd | `EnvironmentFile=/etc/openclaw/secrets.env` in the unit's `[Service]` block; the file is `chmod 600` and owned by root |
| Fly.io | `fly secrets set GRANOLA_API_KEY=grn_...` (then redeploy) |
| Docker / compose | `environment:` block with `${GRANOLA_API_KEY}`, value from host env or a Docker secret |
| AWS EC2 + Secrets Manager | Boot script (cloud-init / launch template) fetches → writes to the systemd `EnvironmentFile` referenced above |
| Kubernetes | `Secret` mounted as env via `envFrom: secretRef:` on the OpenClaw pod spec |

### Sandbox caveat

If OpenClaw runs skills inside a Docker sandbox (`agents.defaults.sandbox.backend: "docker"`), the `apiKey` resolution only applies to *host* runs — sandbox processes don't inherit the host env. You'll also need:

```json5
agents: {
  defaults: {
    sandbox: {
      docker: {
        env: { GRANOLA_API_KEY: "grn_xxxxxxxxxxxxx" }
      }
    }
  }
}
```

Or bake the value into your custom sandbox image. Most personal setups don't sandbox skills, so this is rarely needed.

## Develop

```bash
git clone https://github.com/alavida-ai/granola-plugin
cd granola-plugin
uv sync
uv run granola --help
```

## Bundled skill

The CLI ships with a Claude/OpenClaw skill that teaches the agent when and how to use `granola ...`. The skill source is at `skills/granola/` in this repo: `SKILL.md` plus `references/{notes,folders}.md`.

The skill is distributed as a **plugin** for each agentic runtime — pick the path that matches your host:

### Claude Code (plugin)

```bash
# 1. Add this repo as a plugin marketplace
claude plugin marketplace add github:alavida-ai/granola-plugin

# 2. Install the plugin
claude plugin install granola@granola-plugin
```

A fresh Claude Code session will discover the `granola` skill automatically. The agent invokes it on demand when a user asks about meetings, notes, or transcripts.

The plugin source lives at [`plugins/claude-code/`](./plugins/claude-code/) — `.claude-plugin/plugin.json` plus a `skills/granola/` symlink to the canonical skill at the repo root.

### OpenClaw (plugin)

The plugin is published to **GitHub Packages** as `@alavida-ai/granola-plugin-openclaw`. Each OpenClaw host needs a one-time auth setup, after which install and update are one-liners.

```bash
# 1. One-time per host: configure GitHub Packages auth (PAT with `read:packages` scope)
cat >> ~/.npmrc <<'EOF'
@alavida-ai:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_PAT_HERE
EOF
chmod 600 ~/.npmrc

# 2. Install the granola host CLI (the plugin's skill calls it)
uv tool install git+https://github.com/alavida-ai/granola-plugin

# 3. Wire GRANOLA_API_KEY into ~/.openclaw/openclaw.json
#    (see "OpenClaw deployment" above for the plaintext vs SecretRef shape)

# 4. Install the plugin from GitHub Packages
openclaw plugins install @alavida-ai/granola-plugin-openclaw

# 5. Restart the gateway so the plugin + skill are picked up
openclaw gateway restart

# Updating later: one-liner
openclaw plugins update @alavida-ai/granola-plugin-openclaw && openclaw gateway restart
```

Plugin source: [`plugins/openclaw/`](./plugins/openclaw/) — `package.json` (with the `openclaw` block), `openclaw.plugin.json`, `src/{index,setup-entry}.ts`, and a `skills/granola/` symlink to the canonical skill at the repo root. See [`plugins/openclaw/README.md`](./plugins/openclaw/README.md) for the release flow (tag → CI publishes to GitHub Packages).

### Legacy: `granola skill install` (deprecated)

Earlier releases distributed the skill via a CLI subcommand that copied `skills/granola/` onto disk. That path is **deprecated** in favour of the plugin install paths above. The subcommand still works for one release to give downstream consumers time to migrate; it will be removed in a follow-up. New deployments should use the plugin paths.

```bash
# Deprecated — use the plugin install paths above instead.
granola skill install --target ~/.claude/skills/granola
granola skill install --workspace ~/wkdir     # → ~/wkdir/skills/granola
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

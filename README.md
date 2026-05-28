# granola-plugin

Alavida's Granola integration — a TypeScript monorepo that ships a CLI, an OpenClaw plugin, and a Claude Code plugin for reading meeting notes, AI summaries, transcripts, and folders from [Granola.ai](https://granola.ai).

Read-only — Granola's public API exposes no write endpoints. Bearer-token auth via a personal API key the user generates in the Granola desktop app, exposed as `GRANOLA_API_KEY`.

## Packages

| Package | Purpose |
|---|---|
| [`@alavida-ai/granola-core`](packages/core) | Granola API client. Zero runtime deps (native `fetch`). |
| [`@alavida-ai/granola-cli`](packages/cli) | `granola` CLI binary for terminals and shell pipelines. |
| [`@alavida-ai/granola-plugin-openclaw`](packages/openclaw) | OpenClaw plugin with native tools: `list_notes`, `read_note`, `list_folders`. |
| [`plugins/claude-code`](plugins/claude-code) | Claude Code plugin — ships a skill that drives the `granola` CLI. |

## Develop

Requires Node ≥ 20 and pnpm ≥ 11. Get pnpm via Corepack — it routes to the exact version pinned in `package.json`:

```bash
corepack enable
pnpm install
pnpm -r run build
pnpm -r run typecheck
```

`preinstall` refuses `npm install` / `yarn` / `bun` to prevent accidental supply-chain drift. The `pnpm-workspace.yaml` codifies the pnpm 11 supply-chain defaults (24-hour version cooldown, no exotic subdependency sources, explicit per-package install-script allowlist) — see [`alavida-kb/wiki/javascript-supply-chain-security.md`](https://github.com/alavida-ai/alavida-kb/blob/main/wiki/javascript-supply-chain-security.md).

### Local CLI

```bash
pnpm -r run build
node packages/cli/dist/index.js whoami
# or, after pnpm link:
pnpm link --global ./packages/cli
granola whoami
```

## Set the API key

1. In the Granola desktop app: **Settings → API → Create new key**.
2. Export it: `export GRANOLA_API_KEY=grn_...` (or drop it in `.env` and load via your environment manager).
3. For production deployments, inject `GRANOLA_API_KEY` from your secret manager at process start.

## OpenClaw deployment

The OpenClaw plugin (`@alavida-ai/granola-plugin-openclaw`) registers three native tools — `list_notes`, `read_note`, `list_folders` — that call Granola directly via the bundled API client. No host CLI is required. The plugin reads the API key from `pluginConfig.granolaApiKey` or the `GRANOLA_API_KEY` env var.

### Install in an OpenClaw agent

OpenClaw plugins are installed via `openclaw plugins install npm:<package>` — not `pnpm add` / `npm install`. OpenClaw runs npm against a managed plugin npm root with `--ignore-scripts` for safety. Npm specs are registry-only (exact version or dist-tag; semver ranges and git/url/file specs are rejected — see the [OpenClaw plugin install docs](https://github.com/openclaw/openclaw/blob/main/docs/cli/plugins.md)).

All three packages publish to **GitHub Packages** under the `@alavida-ai` scope. Since OpenClaw shells out to npm, scoped-registry auth has to live somewhere npm picks it up — `~/.npmrc` is the simplest:

```ini
# ~/.npmrc
@alavida-ai:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GHP_READ_PACKAGES_TOKEN}
```

Export a GitHub PAT (classic) with `read:packages` scope in your shell (or your secret manager / CI env), then install via OpenClaw:

```bash
export GHP_READ_PACKAGES_TOKEN=ghp_xxx...
openclaw plugins install npm:@alavida-ai/granola-plugin-openclaw@0.4.0
```

Set `GRANOLA_API_KEY` (or pass `granolaApiKey` in `pluginConfig`) and restart the gateway — the plugin self-registers `list_notes`, `read_note`, `list_folders` on startup.

## Claude Code deployment

The Claude Code plugin at [`plugins/claude-code/`](plugins/claude-code) ships only a skill — the agent invokes the `granola` CLI binary, so the operator installs the CLI separately. The marketplace entry is at [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json).

## Release flow

Versioning + publishing is driven by [changesets](https://github.com/changesets/changesets):

1. Make a change worth releasing.
2. Run `pnpm changeset` — describe the change, pick affected packages and bump level (major/minor/patch). The CLI writes a `*.md` file to [`.changeset/`](.changeset).
3. Commit the changeset alongside your code. Open a PR. Merge to `main`.
4. The [Release workflow](.github/workflows/release.yml) sees pending changesets and opens (or updates) a **"Version Packages"** PR that bumps the affected packages' versions and rewrites `CHANGELOG.md` per package.
5. Merge that auto-opened PR. The workflow runs again and publishes every just-bumped package to GitHub Packages.

So a release is: changeset PR → merge → merge auto-opened version PR → published.

Internal workspace dependencies (`workspace:*`) get an automatic patch bump when their upstream changes — codified in [`.changeset/config.json`](.changeset/config.json) via `updateInternalDependencies: patch`.

## CLI quick reference

```bash
granola whoami                                     # verify key works, guess identity
granola notes list -n 10                           # 10 most recent notes
granola notes list --after 2026-04-01 --json       # JSON envelope
granola notes read not_xxxxxxxxxxxxxx              # markdown summary
granola notes read not_xxxxxxxxxxxxxx --transcript # add full transcript
granola folders list --json                        # all folders, JSON envelope
```

Stdout = data, stderr = human messages. All commands that return data support `--json`. Run `granola --help` or `granola <command> --help` for full options.

# granola OpenClaw plugin

Auto-loads the [granola skill](../../skills/granola) into the OpenClaw agent runtime so agents can read meeting notes, transcripts, and folders from [Granola.ai](https://granola.ai) via the [granola CLI](../..).

> **Status:** v0.1 — single-tenant. Per-agent permission filtering ships in v1.x; today every agent sees the granola skill.

## How it works

1. The host has the `granola` host CLI installed (a Python tool installed globally via `uv tool install git+https://github.com/alavida-ai/granola-cli`) and `GRANOLA_API_KEY` set in the OpenClaw gateway's process environment.
2. The plugin bundles `skills/granola/` (a symlink to the canonical skill at the repo root). OpenClaw auto-discovers plugin skills on load and exposes the granola skill to every agent that's allowed to see it.
3. When the user asks about meetings, the agent triggers the skill, which instructs it to call `granola notes list | read` etc. The CLI hits Granola's public API on the user's behalf.

This plugin owns step (2). The setup script wires step (1) — installing the host CLI and confirming the API key is reachable.

## Install

The plugin is published as a private npm package on **GitHub Packages** under `@alavida-ai/granola-openclaw`. Distribution is one-time auth-config per host, then a one-liner per install/update.

### One-time, per host: configure GitHub Packages auth

You need a personal access token (PAT) with `read:packages` scope.

1. Generate the PAT: GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token. Resource owner: `alavida-ai`. Permissions: **Packages → Read-only**. Save the token somewhere safe — you can't retrieve it again.

2. Drop it into `~/.npmrc` on the OpenClaw host:

   ```bash
   cat >> ~/.npmrc <<'EOF'
   @alavida-ai:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=YOUR_PAT_HERE
   EOF
   chmod 600 ~/.npmrc
   ```

   `chmod 600` makes the file owner-only readable — the PAT is a long-lived secret, treat it like one.

### Install

```bash
# 1. Install the plugin (npm scheme — pulls from GitHub Packages via the ~/.npmrc above)
openclaw plugins install npm:@alavida-ai/granola-openclaw

# 2. Run the setup script (installs granola CLI on host + checks GRANOLA_API_KEY)
cd ~/.openclaw/plugins/granola   # path may vary
npx tsx src/setup-entry.ts

# 3. Wire GRANOLA_API_KEY into the gateway (see the granola README's
#    "OpenClaw deployment" section for personal vs production shapes)
```

The setup script is idempotent — rerun it any time. It will:

- check for the `granola` binary and offer to `uv tool install` it
- confirm `GRANOLA_API_KEY` is set in the current process environment
- print clear instructions if either piece is missing

### Setup script flags

```
--no-install        Skip the granola CLI install check
--dry-run           Print intended actions without changing anything
```

### Updating

```bash
openclaw plugins update @alavida-ai/granola-openclaw
# or update everything at once:
openclaw plugins update --all
```

Then `openclaw gateway restart` to pick up the new code.

## Verification

After setup, restart the gateway and confirm the skill is loaded:

```bash
openclaw gateway restart
openclaw skills list                          # 'granola' should appear
openclaw plugins inspect granola --runtime    # confirm runtime registration
```

Then bootstrap any agent and confirm it can read your meeting notes:

> "What did I discuss in my last call?"

## What this plugin does *not* do

- **Patch `bootstrap-extra-files`.** The granola skill is bundled with this plugin; OpenClaw auto-discovers it. Patching the bootstrap hook would inject the skill content into agent context twice — once via skill load, once via raw markdown. The kb-cli OpenClaw plugin patches the hook because *its* deliverable (per-tenant KB markdown) is dynamic and external to the plugin bundle. granola's deliverable is a single, bundled skill — different shape.
- **Wire the API key into OpenClaw config.** The setup script checks the env var but does not write to `~/.openclaw/openclaw.json`. Operators choose the shape (plaintext for personal, SecretRef for production) and apply it themselves — see the [granola README's OpenClaw deployment section](../../README.md#openclaw-deployment).
- **Per-agent permission filtering.** Coming in v1.x. Until then, every agent that can see plugins on this gateway sees the granola skill.

## Files

```
plugins/openclaw/
├── package.json              # NPM manifest with `openclaw` block
├── openclaw.plugin.json      # OpenClaw plugin manifest
├── tsconfig.json
├── src/
│   ├── index.ts              # definePluginEntry — plugin metadata
│   └── setup-entry.ts        # standalone install/config script
├── types/
│   └── openclaw-plugin-sdk.d.ts  # ambient stub so it typechecks standalone
└── skills/granola/           # symlink → ../../skills/granola (the canonical skill doc)
```

## Building from source

```bash
cd plugins/openclaw
npm install
npm run typecheck
npm run build
```

## Releasing a new version

The publish step is automated via `.github/workflows/publish-openclaw.yml`. To cut a release:

```bash
cd plugins/openclaw

# Bump the version (creates a commit on whatever branch you're on)
npm version patch    # or minor / major

# Read back the new version and create a path-prefixed tag
new_version="$(node -p "require('./package.json').version")"
git tag "plugins/openclaw/v${new_version}" -m "openclaw plugin v${new_version}"

# Push commit + tag — the workflow takes over from here
git push origin main "plugins/openclaw/v${new_version}"
```

The workflow:
1. Checks out the tagged commit
2. Verifies `package.json` version matches the tag
3. Runs typecheck + build
4. Publishes to GitHub Packages using the auto-provided `GITHUB_TOKEN` (no secrets to configure)

Hosts on the new version: `openclaw plugins update @alavida-ai/granola-openclaw && openclaw gateway restart`.

## Tracked in

- [ALA-729](https://linear.app/alavida) — Add OpenClaw plugin to granola repo
- [ALA-730](https://linear.app/alavida) — Distribute via GitHub Packages

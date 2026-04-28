# Authentication

Granola uses a static Bearer API key. There's no OAuth, no device-code flow, no refresh tokens. The user generates a key in the desktop app once and exposes it to the CLI as an environment variable.

## First-time setup (per user)

1. **Get the key.** In the Granola desktop app: Settings → API → Create new key.
   - **Personal API Key** for individual access (Business/Enterprise plans).
   - **Enterprise API Key** if you're a workspace admin and want access to all team-space notes.
   - Note: Enterprise admins must enable Personal keys via Settings → Workspace → "Allow personal API keys" before users can create them.

2. **Expose it as an env var:**

   **Local dev** — add to `.env` in the project (or in `~/.granola-cli/.env`):
   ```
   GRANOLA_API_KEY=grn_xxxxxxxxxxxxx
   ```
   The CLI loads `.env` automatically via `python-dotenv` on every invocation.

   **Shell** — `export GRANOLA_API_KEY=grn_xxx` in your `~/.zshrc` / `~/.bashrc`.

   **OpenClaw** — wire via `~/.openclaw/openclaw.json`. The skill declares `primaryEnv: "GRANOLA_API_KEY"` in its metadata, so OpenClaw's canonical place is `skills.entries.granola.apiKey`. Two shapes:

   ```json5
   // Personal / single-operator: plaintext on disk, chmod 600 the file
   skills: { entries: { granola: { enabled: true,
     apiKey: "grn_xxxxxxxxxxxxx"
   }}}

   // Production: SecretRef — value lives in host process env, openclaw.json never holds it
   skills: { entries: { granola: { enabled: true,
     apiKey: { source: "env", provider: "default", id: "GRANOLA_API_KEY" }
   }}}
   ```

   **Production (EC2 / k8s / Lambda / Fly)** — pull the key from your secret manager (AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault, Fly secrets, etc.) and inject it as `GRANOLA_API_KEY` at process start. Pair with the SecretRef form above so `openclaw.json` never holds the secret. See the [README → OpenClaw deployment section](https://github.com/alavida-ai/granola-cli#openclaw-deployment) for shape-by-shape examples.

## Verify

```bash
granola whoami                  # exits 1 if no key or key rejected
granola whoami --json           # full envelope incl. likely_you, all_owners[], sample_size
granola whoami --sample 100     # widen the sample for noisy workspaces
```

`granola whoami` does TWO things:
1. **Validates the key** by hitting `/v1/notes`. Exit code 0 = key works, 1 = unset or rejected.
2. **Guesses identity** by sampling the most recent 30 notes and counting owners.

**The identity guess is a heuristic, not ground truth.** Granola has no `/me` endpoint. Personal API keys see your own notes plus notes shared with you. If a heavy sharer (e.g. workspace admin) dominates your recent feed, they'll be reported as "likely you" — incorrectly. The output lists all distinct owners with counts so you can sanity-check.

Workarounds:
- `--sample 100` to widen the window (more of your own notes drown out shared ones)
- Treat `whoami` as a key-validity probe; ask the user directly when you need their identity for anything consequential.

JSON envelope:
```json
{
  "authenticated":  true,
  "sample_size":    30,
  "likely_you":     {"name": "...", "email": "...", "count": 18},
  "all_owners":     [{"name": "...", "email": "...", "count": 18}, ...]
}
```

## Re-auth triggers

Bearer keys don't expire on their own. You'll need a new key only if:
- The user revokes the key in the Granola desktop app.
- The user generates a new key and rotates the old one out.
- The workspace admin disables personal API keys.

If any command exits with `GRANOLA_API_KEY not set` or `Granola rejected the API key (401)`, update the env var with a fresh key.

## Optional override

```
GRANOLA_API_BASE=https://staging-api.granola.ai   # rarely needed
```

## Agent pattern for first-time onboarding

Don't paste the key over Slack or email. Tell the user where to put it based on how the agent runs:

- **Local dev (Claude Code, plain shell):** "Open the Granola desktop app → Settings → API → Create new key. Then add `GRANOLA_API_KEY=grn_xxx` to your `.env` file. Run `granola whoami` to verify."
- **OpenClaw on a personal VPS:** "Add it to `~/.openclaw/openclaw.json` under `skills.entries.granola.apiKey`, `chmod 600 ~/.openclaw/openclaw.json`, then `openclaw gateway restart`."
- **OpenClaw production (client work):** point the deployer at their secret manager — the OpenClaw process needs `GRANOLA_API_KEY` in its env, then `openclaw.json` references it via `apiKey: { source: "env", id: "GRANOLA_API_KEY" }`.

If `granola whoami` exits with `GRANOLA_API_KEY not set`, the var didn't reach the process — check the rung above (env-var injection) before assuming the key is wrong.

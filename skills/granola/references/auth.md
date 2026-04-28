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

   **Production (EC2 / k8s / Lambda)** — pull the key from your secret manager (AWS Secrets Manager, AWS Parameter Store, GCP Secret Manager, HashiCorp Vault, Doppler, etc.) and inject it as `GRANOLA_API_KEY` at process start. This is the canonical deployment path — agents never see the key on disk.

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

Don't paste the key over Slack or email. Tell the user:

> "Open the Granola desktop app → Settings → API → Create new key. Then add `GRANOLA_API_KEY=grn_xxx` to your `.env` file (or export it in your shell). Run `granola whoami` to verify."

For headless / production agents, point the deployer at their secret manager — the agent process expects `GRANOLA_API_KEY` to be present at startup, period.

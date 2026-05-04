/**
 * OpenClaw plugin entry — granola.
 *
 * Registers the plugin with OpenClaw. The deliverable is the bundled
 * `skills/granola/` directory (a symlink to the canonical skill at the
 * granola repo root) — OpenClaw auto-discovers plugin skills, so we
 * don't need to register tools, providers, or hook handlers here.
 *
 * Heavy lifting (verifying the host `granola` CLI is installed and
 * GRANOLA_API_KEY is set) is done by the standalone setup script the
 * user runs once after `openclaw plugins install` — see ./setup-entry.ts.
 *
 * SDK docs: https://docs.openclaw.ai/plugins/building-plugins
 */
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

export default definePluginEntry({
  id: "granola",
  name: "granola",
  description:
    "Auto-loads the granola skill into OpenClaw so agents can read meeting notes, transcripts, and folders from Granola.ai via the granola CLI.",
  register(_api) {
    // No tools, providers, or hook handlers registered today.
    //
    // The skill itself (skills/granola/SKILL.md) instructs the agent on
    // when and how to invoke the host `granola` CLI. The CLI is wired up
    // out-of-band by the setup script (see ./setup-entry.ts).
    //
    // v1.x: per-agent permission filtering will hook in here, reading
    // `agentId` from this plugin's config and consulting workspace policy
    // before exposing the skill.
  },
});

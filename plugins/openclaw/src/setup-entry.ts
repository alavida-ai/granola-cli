#!/usr/bin/env node
/**
 * Standalone setup script for the granola OpenClaw plugin.
 *
 * Run once after `openclaw plugins install`:
 *
 *   tsx plugins/openclaw/src/setup-entry.ts [--no-install] [--dry-run]
 *
 * Steps (idempotent):
 *   1. Verify (or install) the `granola` host CLI via `uv tool install`.
 *   2. Check that `GRANOLA_API_KEY` is set in the OpenClaw process
 *      environment; print clear setup instructions if not.
 *
 * What this script does NOT do, and why:
 *   - Patch `hooks.internal.entries.bootstrap-extra-files`. The granola
 *     skill is bundled with this plugin (`./skills/granola/`) and OpenClaw
 *     auto-discovers it on plugin load. Patching the bootstrap hook would
 *     duplicate the skill into the agent context twice. Leave the hook
 *     alone.
 *   - Wire the API key into OpenClaw's skills config. The skill declares
 *     `requires.env: ["GRANOLA_API_KEY"]` in its frontmatter; OpenClaw
 *     gates skill load on env presence. Operators should set the env var
 *     via their secret manager or, for personal use, in the OpenClaw
 *     gateway's `apiKey` block. See the granola README for both shapes.
 */

import { execSync, spawnSync } from "node:child_process";

interface CliFlags {
  install: boolean;
  dryRun: boolean;
}

function parseArgs(argv: string[]): CliFlags {
  const flags: CliFlags = { install: true, dryRun: false };
  for (const arg of argv) {
    switch (arg) {
      case "--no-install":
        flags.install = false;
        break;
      case "--dry-run":
        flags.dryRun = true;
        break;
      case "-h":
      case "--help":
        printHelp();
        process.exit(0);
      default:
        if (arg.startsWith("--")) {
          console.error(`Unknown flag: ${arg}`);
          process.exit(2);
        }
    }
  }
  return flags;
}

function printHelp(): void {
  console.log(`Usage: granola-openclaw-setup [options]

Options:
  --no-install        Skip the granola CLI install check.
  --dry-run           Print intended actions without changing anything.
  -h, --help          Show this help.
`);
}

function which(bin: string): string | null {
  // POSIX \`command -v\` via a shell string (avoids the Node 20+
  // deprecation warning about array args + shell:true).
  const result = spawnSync(`command -v ${bin}`, {
    shell: true,
    encoding: "utf8",
  });
  if (result.status === 0 && result.stdout.trim()) {
    return result.stdout.trim();
  }
  return null;
}

function ensureGranolaInstalled(dryRun: boolean): void {
  const granola = which("granola");
  if (granola) {
    console.log(`✓ granola CLI present: ${granola}`);
    return;
  }
  const cmd =
    "uv tool install --from git+https://github.com/alavida-ai/granola-plugin granola-cli";
  if (dryRun) {
    console.log(`[dry-run] would run: ${cmd}`);
    return;
  }
  if (!which("uv")) {
    throw new Error(
      "granola CLI is not installed and `uv` is not on PATH. " +
        "Install uv (https://docs.astral.sh/uv/) or rerun with --no-install " +
        "and install granola-cli manually.",
    );
  }
  console.log(`→ installing granola CLI: ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

function checkApiKey(): void {
  const key = process.env.GRANOLA_API_KEY;
  if (key && key.trim()) {
    // Don't echo the key — just confirm presence.
    console.log("✓ GRANOLA_API_KEY is set in this process environment.");
    return;
  }

  console.log(
    [
      "",
      "⚠ GRANOLA_API_KEY is not set in this process environment.",
      "",
      "  The granola skill declares this env var as required. OpenClaw will",
      "  skip-load the skill until the gateway process sees the key.",
      "",
      "  To set it (pick the shape that matches your deployment):",
      "",
      "  Personal / single-operator (plaintext in OpenClaw gateway config):",
      "    Edit ~/.openclaw/openclaw.json and set:",
      '      { "skills": { "entries": { "granola": {',
      '          "enabled": true,',
      '          "apiKey": "grn_xxxxxxxxxxxxx"',
      "      } } } }",
      "    Then: chmod 600 ~/.openclaw/openclaw.json && openclaw gateway restart",
      "",
      "  Production / client work (env var via secret manager):",
      "    Edit ~/.openclaw/openclaw.json and set:",
      '      { "skills": { "entries": { "granola": {',
      '          "enabled": true,',
      '          "apiKey": { "source": "env", "provider": "default", "id": "GRANOLA_API_KEY" }',
      "      } } } }",
      "    Then inject GRANOLA_API_KEY into the gateway process via your",
      "    deployment's standard secret-injection path (systemd EnvironmentFile,",
      "    Fly secrets, Docker secret, k8s envFrom secretRef, etc.).",
      "",
      "  See https://github.com/alavida-ai/granola-plugin#openclaw-deployment for the full table.",
      "",
    ].join("\n"),
  );
}

function main(): void {
  const flags = parseArgs(process.argv.slice(2));

  if (flags.install) ensureGranolaInstalled(flags.dryRun);
  checkApiKey();

  console.log("");
  console.log("Setup complete. Restart the OpenClaw gateway so the plugin");
  console.log("and the granola skill are picked up:");
  console.log("  openclaw gateway restart");
  console.log("  openclaw skills list   # confirm 'granola' is loaded");
}

main();

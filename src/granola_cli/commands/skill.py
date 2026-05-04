"""`granola skill` sub-app — manage the bundled Claude/OpenClaw skill."""

from __future__ import annotations

import os
import shutil
import sys
from contextlib import contextmanager
from importlib.resources import as_file, files
from pathlib import Path
from typing import Annotated, Iterator

import typer

import granola_cli
from granola_cli.commands._common import err_console

app = typer.Typer(
    help=(
        "[DEPRECATED] Bundled skill management. Prefer the plugin install paths: "
        "`claude plugin install granola@granola-cli` for Claude Code, "
        "`openclaw plugins install git:github.com/alavida-ai/granola-cli#plugins/openclaw` "
        "for OpenClaw. This command stays for one release, then goes."
    ),
    no_args_is_help=True,
)

# Path inside the package where bundled skill files live (force-included via pyproject).
_BUNDLED_PARTS = ("_skills", "granola")


@contextmanager
def _bundled_skill_path() -> Iterator[Path]:
    """Resolve the bundled skill directory.

    Wheel install: files have been force-included into granola_cli/_skills/granola
    by Hatch at build time — return that path.

    Editable / dev install (`uv sync` from source): the force-include is a
    build-time step, so _skills/ doesn't exist. Fall back to the source tree's
    `skills/granola/` next to `src/granola_cli/`. Allows dev-mode `skill install`
    to work without a wheel build.
    """
    src = files("granola_cli")
    for part in _BUNDLED_PARTS:
        src = src / part
    with as_file(src) as src_path:
        if src_path.exists():
            yield src_path
            return

        pkg_root = Path(granola_cli.__file__).resolve().parent
        candidate = pkg_root.parent.parent / "skills" / "granola"
        if candidate.exists():
            yield candidate
            return

        err_console.print(
            f"[red]Bundled skill files not found at {src_path}.[/red]\n"
            f"Also looked for dev fallback at {candidate}.\n"
            "Reinstall via "
            "`uv tool install --upgrade git+https://github.com/alavida-ai/granola-cli`."
        )
        raise typer.Exit(2)


def _resolve_target(workspace: Path | None, target: Path | None) -> Path:
    """Pick the install destination based on flags, env, and defaults.

    Priority:
      1. --target <path>           — raw destination (used as-is)
      2. --workspace <path>        — installs to <path>/skills/granola
      3. OPENCLAW_WORKSPACE env    — same as --workspace
      4. Default                   — ~/.openclaw/skills/granola  (managed/local)
    """
    if target is not None and workspace is not None:
        err_console.print("[red]--target and --workspace are mutually exclusive.[/red]")
        raise typer.Exit(2)

    if target is not None:
        return target.expanduser().resolve()

    if workspace is None:
        env_ws = os.environ.get("OPENCLAW_WORKSPACE")
        if env_ws:
            workspace = Path(env_ws)

    if workspace is not None:
        return workspace.expanduser().resolve() / "skills" / "granola"

    return Path.home() / ".openclaw" / "skills" / "granola"


@app.command("install")
def install(
    workspace: Annotated[
        Path | None,
        typer.Option(
            "--workspace",
            help=(
                "Install to <workspace>/skills/granola (workspace-level, highest "
                "precedence in OpenClaw). Falls back to OPENCLAW_WORKSPACE env if unset."
            ),
        ),
    ] = None,
    target: Annotated[
        Path | None,
        typer.Option(
            "--target",
            help=(
                "Install to this exact path (overrides --workspace). Use for "
                "Claude Code (~/.claude/skills/granola) or non-standard layouts."
            ),
        ),
    ] = None,
    force: Annotated[
        bool,
        typer.Option("--force", help="Overwrite an existing installation."),
    ] = False,
):
    """[DEPRECATED] Install the bundled skill onto disk.

    Prefer the plugin install paths instead:

      Claude Code:  claude plugin marketplace add github:alavida-ai/granola-cli
                    claude plugin install granola@granola-cli
      OpenClaw:     openclaw plugins install git:github.com/alavida-ai/granola-cli#plugins/openclaw

    This command remains for one release for backwards compatibility; it will
    be removed in a follow-up.

    Resolution order:
      1. --target <path>            install to <path> exactly
      2. --workspace <path>         install to <path>/skills/granola
      3. $OPENCLAW_WORKSPACE        install to $OPENCLAW_WORKSPACE/skills/granola
      4. (default)                  install to ~/.openclaw/skills/granola

    Common skill locations (precedence: highest first, OpenClaw):
      <workspace>/skills/granola                    workspace skills (highest)
      <workspace>/.agents/skills/granola            project agent skills
      ~/.agents/skills/granola                      personal agent skills
      ~/.openclaw/skills/granola                    managed/local (default)

    For Claude Code, install to one of:
      ~/.claude/skills/granola                      user-scope (recommended)
      <project>/.claude/skills/granola              project-scope
    """
    err_console.print(
        "[yellow]`granola skill install` is deprecated.[/yellow] "
        "Use the plugin install paths instead — see "
        "https://github.com/alavida-ai/granola-cli#bundled-skill"
    )

    dest = _resolve_target(workspace, target)

    if dest.exists() and not force:
        err_console.print(
            f"[yellow]Skill already installed at {dest}.[/yellow]\n"
            "Use --force to overwrite, or `granola skill uninstall` first."
        )
        raise typer.Exit(1)

    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        shutil.rmtree(dest)

    with _bundled_skill_path() as src_path:
        shutil.copytree(src_path, dest)

    err_console.print(f"[green]Skill installed at[/green] {dest}")


@app.command("uninstall")
def uninstall(
    workspace: Annotated[
        Path | None,
        typer.Option(
            "--workspace",
            help="Uninstall from <workspace>/skills/granola. Honours OPENCLAW_WORKSPACE.",
        ),
    ] = None,
    target: Annotated[
        Path | None,
        typer.Option("--target", help="Uninstall from this exact path."),
    ] = None,
):
    """Remove the skill from disk."""
    dest = _resolve_target(workspace, target)

    if not dest.exists():
        err_console.print(f"[yellow]No skill at {dest}.[/yellow]")
        raise typer.Exit(1)

    shutil.rmtree(dest)
    err_console.print(f"[green]Skill removed from[/green] {dest}")


@app.command("path")
def path(
    bundled: Annotated[
        bool,
        typer.Option(
            "--bundled/--installed",
            help="Show the bundled source path (default) or the resolved install path.",
        ),
    ] = True,
    workspace: Annotated[
        Path | None,
        typer.Option("--workspace", help="See `granola skill install --help` for resolution."),
    ] = None,
    target: Annotated[
        Path | None, typer.Option("--target", help="Raw path override.")
    ] = None,
):
    """Print a path:
      --bundled (default)  the bundled skill source inside the installed wheel
      --installed          the on-disk install destination (uses same resolution as `install`)
    """
    # Path output goes to stdout (it IS the data) and bypasses Rich console
    # so long paths aren't wrapped with embedded newlines. Lets shell scripts do
    # things like  `cd "$(granola skill path --installed)"`  safely.
    if bundled:
        with _bundled_skill_path() as src_path:
            sys.stdout.write(f"{src_path}\n")
        return

    dest = _resolve_target(workspace, target)
    sys.stdout.write(f"{dest}\n")

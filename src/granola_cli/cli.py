"""Typer root app — wires the granola sub-apps and the top-level whoami probe."""

from __future__ import annotations

from collections import Counter
from typing import Annotated

import typer
from dotenv import load_dotenv

from granola_cli import client
from granola_cli.commands import folders, notes, skill
from granola_cli.commands._common import (
    console,
    err_console,
    handle_api_errors,
    print_json,
)

load_dotenv()

app = typer.Typer(
    name="granola",
    help="Alavida Granola CLI — read meeting notes, transcripts, and folders.",
    no_args_is_help=True,
)
app.add_typer(notes.app, name="notes")
app.add_typer(folders.app, name="folders")
app.add_typer(skill.app, name="skill")


# How many recent notes to sample when guessing the user's identity. A larger
# sample makes the heuristic more robust against shared notes from collaborators
# (e.g. a workspace admin who shares a lot) drowning out the user's own activity.
_WHOAMI_SAMPLE = 30


@app.command("whoami")
@handle_api_errors
def whoami(
    sample: Annotated[
        int,
        typer.Option(
            "--sample",
            help=f"Notes to sample when guessing your identity (default {_WHOAMI_SAMPLE}).",
        ),
    ] = _WHOAMI_SAMPLE,
    as_json: Annotated[bool, typer.Option("--json", help="Emit JSON.")] = False,
):
    """Verify GRANOLA_API_KEY works and guess the calling user's identity.

    Granola has no /me endpoint, so identity is inferred from the `owner` field
    across the last N notes (default 30). The most frequent owner is reported as
    "likely you" — your own meetings should dominate the sample, but personal
    keys also see notes shared by collaborators (e.g. a workspace admin who shares
    everything), so the result is a probabilistic guess, not ground truth.

    Exits 1 if GRANOLA_API_KEY is unset or the key is rejected.
    """
    if not client.get_api_key():
        err_console.print(
            "[yellow]GRANOLA_API_KEY is not set.[/yellow]\n"
            "Add it to [cyan].env[/cyan] or export it in your shell. "
            "Get the key from the Granola desktop app: Settings → API → Create new key."
        )
        raise typer.Exit(1)

    notes_seen = list(client.iter_notes(limit=sample, page_size=min(sample, 30)))

    counter: Counter[str] = Counter()
    by_email: dict[str, dict[str, str | None]] = {}
    for n in notes_seen:
        owner = n.get("owner") or {}
        email = owner.get("email")
        if not email:
            continue
        counter[email] += 1
        by_email[email] = {"name": owner.get("name"), "email": email}

    distinct = [
        {"name": by_email[e]["name"], "email": e, "count": c}
        for e, c in counter.most_common()
    ]
    likely = distinct[0] if distinct else None

    info = {
        "authenticated": True,
        "sample_size": len(notes_seen),
        "likely_you": likely,
        "all_owners": distinct,
    }

    if as_json:
        print_json(info)
        return

    err_console.print("[green]API key is valid.[/green]")

    if not notes_seen:
        err_console.print(
            "  No notes accessible — key works, but the workspace has no notes yet."
        )
        return

    if likely:
        err_console.print(
            f"  Likely you: [bold]{likely['name'] or '?'}[/bold] "
            f"<{likely['email']}>  "
            f"[dim]({likely['count']} of {len(notes_seen)} recent notes)[/dim]"
        )

    if len(distinct) > 1:
        err_console.print(
            f"\n[dim]All {len(distinct)} owners across last {len(notes_seen)} notes "
            "(personal keys also see shared notes — pick the one that's actually you):[/dim]"
        )
        for d in distinct:
            err_console.print(
                f"  {d['count']:>3}  {d['name'] or '?':30}  <{d['email']}>"
            )


if __name__ == "__main__":
    app()

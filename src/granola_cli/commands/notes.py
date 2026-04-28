"""`granola notes` sub-app — list and read meeting notes."""

from __future__ import annotations

from typing import Annotated, Any

import typer
from rich.table import Table

from granola_cli import client
from granola_cli.commands._common import (
    console,
    err_console,
    handle_api_errors,
    parse_select,
    print_json,
    print_json_envelope,
)

app = typer.Typer(help="Notes — list, read, get transcripts.", no_args_is_help=True)


def _note_summary(n: dict[str, Any]) -> dict[str, Any]:
    """Flatten a NoteSummary for JSON output."""
    owner = n.get("owner") or {}
    return {
        "id": n.get("id"),
        "title": n.get("title"),
        "owner_name": owner.get("name"),
        "owner_email": owner.get("email"),
        "created_at": n.get("created_at"),
        "updated_at": n.get("updated_at"),
    }


@app.command("list")
@handle_api_errors
def list_(
    limit: Annotated[int, typer.Option("-n", "--limit", help="Max notes to return.")] = 10,
    after: Annotated[
        str | None,
        typer.Option("--after", help="Only notes created on/after this date (YYYY-MM-DD or ISO 8601)."),
    ] = None,
    before: Annotated[
        str | None,
        typer.Option("--before", help="Only notes created on/before this date (YYYY-MM-DD or ISO 8601)."),
    ] = None,
    updated_after: Annotated[
        str | None,
        typer.Option("--updated-after", help="Only notes updated on/after this date."),
    ] = None,
    cursor: Annotated[
        str | None,
        typer.Option("--cursor", help="Resume pagination from this cursor (skips the first N pages)."),
    ] = None,
    page_size: Annotated[
        int,
        typer.Option("--page-size", help="API page size (1-30). Auto-paginates up to --limit."),
    ] = 30,
    as_json: Annotated[bool, typer.Option("--json", help="JSON envelope.")] = False,
    select: Annotated[
        str | None,
        typer.Option("--select", help="Comma-separated field projection (id,title,created_at,...)."),
    ] = None,
):
    """List notes, newest first. Auto-paginates until --limit is hit."""
    if cursor:
        # Single-page fetch when a cursor is provided — caller is driving pagination.
        page = client.list_notes(
            created_after=after,
            created_before=before,
            updated_after=updated_after,
            cursor=cursor,
            page_size=min(page_size, limit),
        )
        notes = page.get("notes", [])
        next_cursor = page.get("cursor")
        has_more = bool(page.get("hasMore"))
    else:
        notes = list(
            client.iter_notes(
                created_after=after,
                created_before=before,
                updated_after=updated_after,
                page_size=min(page_size, 30),
                limit=limit,
            )
        )
        next_cursor = None
        has_more = False

    if as_json:
        print_json_envelope(
            [_note_summary(n) for n in notes],
            cursor=next_cursor,
            has_more=has_more,
            fields=parse_select(select),
        )
        return

    table = Table(title=f"Notes ({len(notes)})")
    table.add_column("Created", style="cyan", no_wrap=True)
    table.add_column("Title")
    table.add_column("Owner", style="magenta")
    table.add_column("ID", style="dim")
    for n in notes:
        owner = (n.get("owner") or {}).get("email") or ""
        created = (n.get("created_at") or "")[:16].replace("T", " ")
        table.add_row(created, n.get("title") or "(untitled)", owner, n.get("id") or "")
    console.print(table)
    if next_cursor:
        err_console.print(f"[dim]Next cursor: {next_cursor}[/dim]")


@app.command("read")
@handle_api_errors
def read(
    note_id: Annotated[str, typer.Argument(help="Note id (from `granola notes list`).")],
    transcript: Annotated[
        bool,
        typer.Option("--transcript", help="Include the full transcript (speaker + timestamps)."),
    ] = False,
    text: Annotated[
        bool,
        typer.Option(
            "--text",
            help="Print plain-text summary instead of markdown. Implied for non-JSON output if --markdown isn't set.",
        ),
    ] = False,
    as_json: Annotated[bool, typer.Option("--json", help="Emit full JSON.")] = False,
):
    """Read a single note. Default: markdown summary. --transcript adds the transcript array."""
    note = client.get_note(note_id, include_transcript=transcript)

    if as_json:
        print_json(note)
        return

    title = note.get("title") or "(untitled)"
    console.rule(title)
    owner = note.get("owner") or {}
    console.print(f"[cyan]Owner:[/cyan]   {owner.get('name') or ''} <{owner.get('email') or ''}>")
    console.print(f"[cyan]Created:[/cyan] {note.get('created_at')}")
    if note.get("web_url"):
        console.print(f"[cyan]URL:[/cyan]     {note.get('web_url')}")

    folders = note.get("folder_membership") or []
    if folders:
        names = ", ".join(f.get("name", "?") for f in folders)
        console.print(f"[cyan]Folders:[/cyan] {names}")

    attendees = note.get("attendees") or []
    if attendees:
        names = ", ".join(
            f"{a.get('name') or '?'} <{a.get('email') or ''}>" for a in attendees
        )
        console.print(f"[cyan]Attendees:[/cyan] {names}")

    console.print()
    body = note.get("summary_text") if text else (note.get("summary_markdown") or note.get("summary_text") or "")
    console.print(body or "[dim](no summary)[/dim]")

    if transcript:
        segments = note.get("transcript") or []
        console.print()
        console.rule("Transcript")
        # Granola's per-speaker identification is binary "Me vs Them" via the
        # `source` channel (matches their app's green/grey bubble UI):
        #   source: microphone -> your mic input  -> "Me"
        #   source: speaker    -> system audio    -> "Them"  (everyone else, merged)
        # On virtual calls (Meet/Teams/Zoom) both sources appear and the label is
        # informative. On in-person meetings only `microphone` appears (room mic
        # captures everyone), so the source no longer means "you" — render those
        # as plain text rather than incorrectly labelling everything "Me".
        # `diarization_label` is the future per-person feature; never populated
        # in the wild today, but if Granola ships it we prefer it.
        sources_seen = {(s.get("speaker") or {}).get("source") for s in segments}
        has_split = "microphone" in sources_seen and "speaker" in sources_seen

        for seg in segments:
            sp = seg.get("speaker") or {}
            text = seg.get("text") or ""
            label = sp.get("diarization_label")
            if not label and has_split:
                label = {"microphone": "Me", "speaker": "Them"}.get(sp.get("source") or "")
            if label:
                console.print(f"[magenta]{label}:[/magenta] {text}")
            else:
                console.print(text)

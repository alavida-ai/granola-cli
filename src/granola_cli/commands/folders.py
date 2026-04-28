"""`granola folders` sub-app — list folders."""

from __future__ import annotations

from typing import Annotated, Any

import typer
from rich.table import Table

from granola_cli import client
from granola_cli.commands._common import (
    console,
    handle_api_errors,
    parse_select,
    print_json_envelope,
)

app = typer.Typer(help="Folders — list folders.", no_args_is_help=True)


def _folder_row(f: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": f.get("id"),
        "name": f.get("name"),
        "parent_folder_id": f.get("parent_folder_id"),
    }


@app.command("list")
@handle_api_errors
def list_(
    limit: Annotated[int, typer.Option("-n", "--limit", help="Max folders to return.")] = 100,
    page_size: Annotated[
        int,
        typer.Option("--page-size", help="API page size (1-30). Auto-paginates up to --limit."),
    ] = 30,
    as_json: Annotated[bool, typer.Option("--json", help="JSON envelope.")] = False,
    select: Annotated[
        str | None,
        typer.Option("--select", help="Comma-separated field projection (id,name,parent_folder_id)."),
    ] = None,
):
    """List folders. Auto-paginates until --limit is hit."""
    folders = list(client.iter_folders(page_size=min(page_size, 30), limit=limit))

    if as_json:
        print_json_envelope(
            [_folder_row(f) for f in folders],
            fields=parse_select(select),
        )
        return

    table = Table(title=f"Folders ({len(folders)})")
    table.add_column("Name")
    table.add_column("Parent ID", style="dim")
    table.add_column("ID", style="dim")
    for f in folders:
        table.add_row(
            f.get("name") or "(unnamed)",
            f.get("parent_folder_id") or "",
            f.get("id") or "",
        )
    console.print(table)

"""Shared helpers for command modules: consoles, JSON envelope, error handling."""

from __future__ import annotations

import functools
import json
import sys
from typing import Any, Callable, TypeVar

import typer
from rich.console import Console

from granola_cli.client import GranolaError, NotAuthenticatedError

console = Console()
err_console = Console(stderr=True)

T = TypeVar("T")


def handle_api_errors(fn: Callable[..., T]) -> Callable[..., T]:
    """Decorator: translate GranolaError / NotAuthenticatedError into clean CLI exits."""

    @functools.wraps(fn)
    def wrapper(*args: Any, **kwargs: Any) -> T:
        try:
            return fn(*args, **kwargs)
        except NotAuthenticatedError as e:
            err_console.print(
                f"[yellow]Not authenticated.[/yellow] {e}\n"
                "Set [cyan]GRANOLA_API_KEY[/cyan] in your .env or shell, then run "
                "[cyan]granola whoami[/cyan] to verify."
            )
            raise typer.Exit(1) from None
        except GranolaError as e:
            err_console.print(f"[red]Granola API error:[/red] {e}")
            raise typer.Exit(1) from None

    return wrapper


def print_json_envelope(
    results: list[Any],
    cursor: str | None = None,
    has_more: bool = False,
    fields: list[str] | None = None,
) -> None:
    """Print a JSON envelope: {results, count, cursor, hasMore}.

    `cursor` is the next-page cursor (or null). `hasMore` mirrors the API.
    Project each result dict to `fields` if provided.
    """
    if fields:
        results = [{k: r.get(k) for k in fields} for r in results]
    envelope = {
        "results": results,
        "count": len(results),
        "cursor": cursor,
        "hasMore": has_more,
    }
    json.dump(envelope, sys.stdout, default=str)
    sys.stdout.write("\n")


def print_json(obj: Any) -> None:
    """Emit a single object as JSON to stdout."""
    json.dump(obj, sys.stdout, default=str)
    sys.stdout.write("\n")


def parse_select(select: str | None) -> list[str] | None:
    """Parse `--select id,title,created_at` into a list."""
    if not select:
        return None
    return [s.strip() for s in select.split(",") if s.strip()]

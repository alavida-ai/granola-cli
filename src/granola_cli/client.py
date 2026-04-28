"""Thin httpx wrapper around the Granola public API.

Base URL: https://public-api.granola.ai
Auth:     Authorization: Bearer grn_...
Docs:     https://docs.granola.ai

Auth model — env var only:

    GRANOLA_API_KEY=grn_xxxxxxxxxxxxx

Read at the start of every CLI invocation via python-dotenv (cli.py calls
load_dotenv() before any command runs). For local dev, drop it in .env. For
production, inject it from your secret manager (AWS Secrets Manager, Vault,
GCP Secret Manager, etc.) — that's the single deployment path.

Optional override:
    GRANOLA_API_BASE   (defaults to https://public-api.granola.ai)

Rate limits: 25 req / 5s burst, 5 req/s sustained. We don't proactively throttle
— callers stay well under in normal use, and 429 surfaces as a clear error.
"""

from __future__ import annotations

import os
from typing import Any, Iterator

import httpx

DEFAULT_BASE_URL = "https://public-api.granola.ai"


class GranolaError(RuntimeError):
    """Raised on non-2xx responses. .status_code carries the HTTP status."""

    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code


class NotAuthenticatedError(GranolaError):
    """No API key in env, or the key was rejected (401)."""


def _base_url() -> str:
    return os.environ.get("GRANOLA_API_BASE", DEFAULT_BASE_URL).rstrip("/")


def get_api_key() -> str | None:
    """Return the API key from GRANOLA_API_KEY, or None if not set."""
    val = os.environ.get("GRANOLA_API_KEY", "").strip()
    return val or None


def _client() -> httpx.Client:
    key = get_api_key()
    if not key:
        raise NotAuthenticatedError(
            401,
            "GRANOLA_API_KEY not set. Add it to .env or export it in your shell.",
        )
    return httpx.Client(
        base_url=_base_url(),
        headers={"Authorization": f"Bearer {key}"},
        timeout=30.0,
    )


def _check(resp: httpx.Response) -> dict[str, Any]:
    if resp.status_code == 401:
        raise NotAuthenticatedError(401, "Granola rejected the API key (401).")
    if resp.status_code >= 400:
        try:
            body = resp.json()
            msg = body.get("message") or body.get("error") or resp.text
        except Exception:
            msg = resp.text or resp.reason_phrase
        raise GranolaError(resp.status_code, f"HTTP {resp.status_code}: {msg}")
    return resp.json()


# ── notes ────────────────────────────────────────────────────────────────

def list_notes(
    *,
    created_before: str | None = None,
    created_after: str | None = None,
    updated_after: str | None = None,
    cursor: str | None = None,
    page_size: int = 10,
) -> dict[str, Any]:
    """One page of notes. Returns {notes: [...], hasMore: bool, cursor: str|null}."""
    params: dict[str, Any] = {"page_size": page_size}
    if created_before:
        params["created_before"] = created_before
    if created_after:
        params["created_after"] = created_after
    if updated_after:
        params["updated_after"] = updated_after
    if cursor:
        params["cursor"] = cursor

    with _client() as c:
        return _check(c.get("/v1/notes", params=params))


def iter_notes(
    *,
    created_before: str | None = None,
    created_after: str | None = None,
    updated_after: str | None = None,
    page_size: int = 30,
    limit: int | None = None,
) -> Iterator[dict[str, Any]]:
    """Yield NoteSummary objects across all pages, stopping at `limit` if set."""
    cursor: str | None = None
    yielded = 0
    while True:
        page = list_notes(
            created_before=created_before,
            created_after=created_after,
            updated_after=updated_after,
            cursor=cursor,
            page_size=page_size,
        )
        for note in page.get("notes", []):
            yield note
            yielded += 1
            if limit is not None and yielded >= limit:
                return
        if not page.get("hasMore"):
            return
        cursor = page.get("cursor")
        if not cursor:
            return


def get_note(note_id: str, *, include_transcript: bool = False) -> dict[str, Any]:
    """Fetch a single note. Pass include_transcript=True to get the transcript array."""
    params = {"include": "transcript"} if include_transcript else None
    with _client() as c:
        return _check(c.get(f"/v1/notes/{note_id}", params=params))


# ── folders ──────────────────────────────────────────────────────────────

def list_folders(*, cursor: str | None = None, page_size: int = 30) -> dict[str, Any]:
    """One page of folders. Returns {folders: [...], hasMore: bool, cursor: str|null}."""
    params: dict[str, Any] = {"page_size": page_size}
    if cursor:
        params["cursor"] = cursor
    with _client() as c:
        return _check(c.get("/v1/folders", params=params))


def iter_folders(*, page_size: int = 30, limit: int | None = None) -> Iterator[dict[str, Any]]:
    """Yield Folder objects across all pages."""
    cursor: str | None = None
    yielded = 0
    while True:
        page = list_folders(cursor=cursor, page_size=page_size)
        for folder in page.get("folders", []):
            yield folder
            yielded += 1
            if limit is not None and yielded >= limit:
                return
        if not page.get("hasMore"):
            return
        cursor = page.get("cursor")
        if not cursor:
            return

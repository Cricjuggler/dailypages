"""Rewriter — chapter content + style profile → typed prose blocks.

Produces the JSON shape that the frontend reader expects (intro/p/pullquote/h2/
section-mark/outro). The style profile is passed as cached system context so
multi-chapter sessions reuse the cache.
"""
from __future__ import annotations

import json
import logging

from app.ai.llm import build_system, call_claude_json
from app.ai.prompts import REWRITER_AGENT

log = logging.getLogger(__name__)


_VALID_KINDS = {"intro", "p", "pullquote", "h2", "section-mark", "outro"}


def rewrite_session(
    *,
    source_text: str,
    style_profile: dict,
    book_meta: dict,
    session_number: int,
    sessions_total: int,
    chapter_label: str,
    estimated_minutes: int,
    depth: str,
) -> list[dict]:
    """Run the rewriter. Returns the validated list of prose blocks.

    Caller is responsible for ensuring source_text fits in context — typically
    we pass one chapter at a time. For long sessions spanning multiple chapters
    we chain calls and concatenate, but most plans pair one chapter ↔ one
    session.
    """
    user = json.dumps(
        {
            "session_number": session_number,
            "sessions_total": sessions_total,
            "chapter_label": chapter_label,
            "estimated_minutes": estimated_minutes,
            "depth": depth,
            "book": {
                "title": book_meta.get("title"),
                "author": book_meta.get("author"),
            },
            "style_profile": style_profile,
            "source_text": source_text,
        },
        indent=2,
    )
    # Cache the prompt + style profile + book meta — these are stable across
    # all sessions of the same book during a generation pass.
    style_block = json.dumps(
        {"book": book_meta, "style_profile": style_profile}, separators=(",", ":")
    )
    system = build_system((REWRITER_AGENT, True), (f"STYLE CONTEXT:\n{style_block}", True))

    blocks_raw = call_claude_json(system=system, user=user, max_tokens=8000)
    if not isinstance(blocks_raw, list):
        log.warning("Rewriter returned non-list: %s", str(blocks_raw)[:200])
        return _fallback_blocks(book_meta, session_number, sessions_total, chapter_label, estimated_minutes)

    return _validate_blocks(
        blocks_raw, book_meta, session_number, sessions_total, chapter_label, estimated_minutes
    )


def _validate_blocks(
    blocks: list[dict],
    book_meta: dict,
    session_number: int,
    sessions_total: int,
    chapter_label: str,
    estimated_minutes: int,
) -> list[dict]:
    cleaned: list[dict] = []
    has_intro = False
    has_outro = False
    dropcap_used = False
    for b in blocks:
        if not isinstance(b, dict):
            continue
        kind = b.get("kind")
        if kind not in _VALID_KINDS:
            continue
        if kind == "intro":
            has_intro = True
        if kind == "outro":
            has_outro = True
        if kind == "p":
            if b.get("dropcap"):
                if dropcap_used:
                    b = {**b, "dropcap": False}
                else:
                    dropcap_used = True
        cleaned.append(b)

    if not has_intro:
        cleaned.insert(0, _intro_block(book_meta, session_number, sessions_total, chapter_label, estimated_minutes))
    if not has_outro:
        cleaned.append({"kind": "outro"})
    if not dropcap_used:
        for b in cleaned:
            if b.get("kind") == "p":
                b["dropcap"] = True
                break

    return cleaned


def _intro_block(
    book_meta: dict,
    session_number: int,
    sessions_total: int,
    chapter_label: str,
    estimated_minutes: int,
) -> dict:
    return {
        "kind": "intro",
        "eyebrow": f"Today · Session {session_number} of {sessions_total}",
        "title": chapter_label or f"Session {session_number}",
        "meta": f"{book_meta.get('author', '')} · {chapter_label} · ~{estimated_minutes} min".strip(" ·"),
    }


def _fallback_blocks(
    book_meta: dict,
    session_number: int,
    sessions_total: int,
    chapter_label: str,
    estimated_minutes: int,
) -> list[dict]:
    return [
        _intro_block(book_meta, session_number, sessions_total, chapter_label, estimated_minutes),
        {
            "kind": "p",
            "dropcap": True,
            "text": (
                "We were unable to generate this session's prose. The original chapter "
                "is preserved in the source, and you can retry generation from the plan screen."
            ),
        },
        {"kind": "outro"},
    ]

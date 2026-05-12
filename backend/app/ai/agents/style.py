"""Style analysis — produces a single book-level voice profile."""
from __future__ import annotations

from app.ai.llm import build_system, call_claude_json
from app.ai.prompts import STYLE_AGENT


def analyze_style(sample_chapters: list[str], book_meta: dict) -> dict:
    """Sample a few representative chapters and produce a style profile.

    We pass at most 4 chapters and cap each to 4k chars. The model returns the
    structured profile JSON described in STYLE_AGENT.
    """
    if not sample_chapters:
        return {}
    sample = sample_chapters[: min(4, len(sample_chapters))]
    parts = []
    for i, text in enumerate(sample):
        excerpt = text if len(text) <= 4000 else text[:4000] + "\n…"
        parts.append(f"--- SAMPLE {i + 1} ---\n{excerpt}")
    user = (
        f"BOOK: {book_meta.get('title', 'Untitled')} by {book_meta.get('author', 'Unknown')}\n\n"
        + "\n\n".join(parts)
    )
    system = build_system((STYLE_AGENT, True))
    return call_claude_json(system=system, user=user, fast=True, max_tokens=1200)

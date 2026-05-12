"""Streaming explain — runs Claude with streaming and yields text chunks.

Used by the Reader's explain bubble. Different from RAG chat: the user clicks
on a paragraph, so we already know the relevant context — no retrieval needed.
"""
from __future__ import annotations

from collections.abc import AsyncIterator

from anthropic import Anthropic

from app.ai.llm import build_system
from app.ai.prompts import GROUNDING
from app.config import get_settings

EXPLAIN_PROMPT = GROUNDING + """

You are explaining a single passage the user just clicked on inside their
reading session. They want a short, illuminating gloss, not a lecture.

Rules:
- Three sentences maximum unless the intent calls for more.
- If they ask for "an example", give a concrete grounded example, not a generic one.
- If they ask "compare to X", explicitly draw the comparison.
- Don't restate the passage; expand on it."""


def _client() -> Anthropic:
    settings = get_settings()
    if not settings.claude_configured:
        raise RuntimeError("Claude not configured")
    return Anthropic(api_key=settings.anthropic_api_key)


async def stream_explanation(
    *,
    paragraph: str,
    book_title: str,
    book_author: str | None,
    chapter: str | None,
    intent: str | None,
) -> AsyncIterator[str]:
    """Yield text chunks as Claude streams its response."""
    settings = get_settings()
    user_prompt = (
        f"BOOK: {book_title}"
        + (f" by {book_author}" if book_author else "")
        + (f" — {chapter}" if chapter else "")
        + f"\n\nPASSAGE:\n{paragraph}"
        + (f"\n\nINTENT: {intent}" if intent else "")
    )
    system = build_system((EXPLAIN_PROMPT, True))
    client = _client()
    with client.messages.stream(
        model=settings.anthropic_model,
        max_tokens=600,
        system=system,
        messages=[{"role": "user", "content": user_prompt}],
    ) as stream:
        for text in stream.text_stream:
            if text:
                yield text

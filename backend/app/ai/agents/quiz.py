"""Quiz + recap generator. Runs once per session after rewriting."""
from __future__ import annotations

import logging

from app.ai.llm import build_system, call_claude_json
from app.ai.prompts import QUIZ_AGENT

log = logging.getLogger(__name__)


def generate_quiz(*, session_blocks: list[dict], book_meta: dict, session_title: str) -> dict:
    """Returns { takeaways, quiz, next_preview }."""
    prose = "\n\n".join(
        b.get("text", "") for b in session_blocks if b.get("kind") in {"p", "pullquote", "h2"}
    )
    user = (
        f"BOOK: {book_meta.get('title')} by {book_meta.get('author')}\n"
        f"SESSION TITLE: {session_title}\n\n"
        f"SESSION CONTENT:\n{prose}"
    )
    system = build_system((QUIZ_AGENT, True))
    try:
        return call_claude_json(system=system, user=user, fast=True, max_tokens=1500)
    except Exception as e:
        log.warning("Quiz generation failed for %s: %s", session_title, e)
        return {"takeaways": [], "quiz": [], "next_preview": ""}

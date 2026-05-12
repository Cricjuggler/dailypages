"""Session planner — turns chapters into N session boundaries.

The LLM gets chapter metadata only (titles + length + complexity), not full
content — boundaries should be a function of structure, not body text.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass

from app.ai.llm import build_system, call_claude_json
from app.ai.prompts import PLANNER_AGENT

log = logging.getLogger(__name__)


@dataclass
class ChapterMeta:
    ordinal: int
    title: str
    length_minutes: int
    complexity: float


@dataclass
class SessionBoundary:
    session_number: int
    title: str
    chapter_label: str
    estimated_minutes: int
    source_ranges: list[dict]


def plan_sessions(
    chapters: list[ChapterMeta],
    *,
    target_sessions: int,
    minutes_per_session: int,
    pace: str,
    depth: str,
) -> list[SessionBoundary]:
    chapter_payload = [
        {
            "ordinal": c.ordinal,
            "title": c.title,
            "length_minutes_estimate": c.length_minutes,
            "complexity": round(c.complexity, 2),
        }
        for c in chapters
    ]
    user = json.dumps(
        {
            "chapters": chapter_payload,
            "target_sessions": target_sessions,
            "minutes_per_session": minutes_per_session,
            "pace": pace,
            "depth": depth,
        },
        indent=2,
    )
    system = build_system((PLANNER_AGENT, True))
    raw = call_claude_json(system=system, user=user, max_tokens=8000)

    sessions = raw.get("sessions") if isinstance(raw, dict) else None
    if not isinstance(sessions, list):
        log.warning("Planner returned unexpected shape: %s", str(raw)[:200])
        return _fallback_plan(chapters, target_sessions, minutes_per_session)

    out: list[SessionBoundary] = []
    for s in sessions:
        try:
            out.append(
                SessionBoundary(
                    session_number=int(s["session_number"]),
                    title=str(s.get("title", f"Session {s.get('session_number')}")),
                    chapter_label=str(s.get("chapter", "")),
                    estimated_minutes=int(s.get("estimated_minutes", minutes_per_session)),
                    source_ranges=list(s.get("source_ranges", [])),
                )
            )
        except (KeyError, TypeError, ValueError) as e:
            log.warning("Skipping malformed session row: %s — %s", s, e)
    if not out:
        return _fallback_plan(chapters, target_sessions, minutes_per_session)
    return out


def _fallback_plan(
    chapters: list[ChapterMeta], target_sessions: int, minutes_per_session: int
) -> list[SessionBoundary]:
    """If the planner fails, distribute chapters evenly across sessions.

    Crude but ensures the user is never blocked. Used as a last resort.
    """
    target = max(1, target_sessions)
    chunks: list[list[ChapterMeta]] = [[] for _ in range(target)]
    for i, c in enumerate(chapters):
        chunks[i % target].append(c)

    out: list[SessionBoundary] = []
    for i, chunk in enumerate(chunks, start=1):
        if not chunk:
            continue
        first = chunk[0]
        out.append(
            SessionBoundary(
                session_number=i,
                title=first.title,
                chapter_label=first.title,
                estimated_minutes=minutes_per_session,
                source_ranges=[
                    {"chapter_ordinal": c.ordinal, "start_paragraph": 0, "end_paragraph": -1}
                    for c in chunk
                ],
            )
        )
    return out

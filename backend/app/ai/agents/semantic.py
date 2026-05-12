"""Semantic understanding — embeddings + concept extraction per chapter."""
from __future__ import annotations

import logging
from dataclasses import dataclass

from app.ai.embeddings import embed_documents
from app.ai.llm import build_system, call_claude_json
from app.ai.prompts import SEMANTIC_AGENT

log = logging.getLogger(__name__)


@dataclass
class ChapterAnalysis:
    embedding: list[float]
    concepts: list[dict]
    complexity: float
    importance: float


def _truncate(text: str, max_chars: int = 12000) -> str:
    return text if len(text) <= max_chars else text[:max_chars] + "\n…"


def analyze_chapters(chapter_texts: list[str], book_meta: dict) -> list[ChapterAnalysis]:
    """Run embeddings + LLM concept extraction across a list of chapter bodies.

    book_meta is a small dict ({title, author}) included as cached system context.
    Embeddings come from Voyage; concepts/scores come from Claude (fast model).
    """
    if not chapter_texts:
        return []

    embeddings = embed_documents(chapter_texts)

    system = build_system(
        (SEMANTIC_AGENT, True),
        (
            f"BOOK: {book_meta.get('title', 'Untitled')} by {book_meta.get('author', 'Unknown')}.",
            True,
        ),
    )

    out: list[ChapterAnalysis] = []
    for idx, text in enumerate(chapter_texts):
        try:
            user = f"CHAPTER {idx + 1} CONTENT:\n\n{_truncate(text)}"
            data = call_claude_json(system=system, user=user, fast=True, max_tokens=1500)
            out.append(
                ChapterAnalysis(
                    embedding=embeddings[idx],
                    concepts=data.get("concepts", []) or [],
                    complexity=float(data.get("complexity", 0.5)),
                    importance=float(data.get("importance", 0.5)),
                )
            )
        except Exception as e:
            log.warning("Semantic analysis failed for chapter %d: %s", idx + 1, e)
            out.append(
                ChapterAnalysis(
                    embedding=embeddings[idx],
                    concepts=[],
                    complexity=0.5,
                    importance=0.5,
                )
            )
    return out

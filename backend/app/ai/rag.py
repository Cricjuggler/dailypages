"""RAG over chapter embeddings — used by /books/{id}/chat."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.embeddings import embed_query
from app.ai.llm import build_system, call_claude
from app.ai.prompts import CHAT_AGENT
from app.models import Book, Chapter


@dataclass
class ChatExcerpt:
    chapter_title: str
    snippet: str
    score: float


async def retrieve_excerpts(
    db: AsyncSession, book_id: uuid.UUID, query: str, *, top_k: int = 4, snippet_chars: int = 1200
) -> list[ChatExcerpt]:
    """Vector-search the top-K most relevant chapters for `query`."""
    q_vec = embed_query(query)
    # cosine_distance returns 0..2 where 0 is identical; lower = more relevant.
    stmt = (
        select(Chapter, Chapter.embedding.cosine_distance(q_vec).label("distance"))
        .where(Chapter.book_id == book_id)
        .where(Chapter.embedding.is_not(None))
        .order_by("distance")
        .limit(top_k)
    )
    result = await db.execute(stmt)
    rows = result.all()
    out: list[ChatExcerpt] = []
    for chapter, distance in rows:
        body = chapter.raw_content or ""
        snippet = body[:snippet_chars] + ("…" if len(body) > snippet_chars else "")
        out.append(
            ChatExcerpt(
                chapter_title=chapter.title,
                snippet=snippet,
                score=float(1.0 - distance),  # invert so higher=better
            )
        )
    return out


async def answer_question(db: AsyncSession, book: Book, question: str) -> dict:
    excerpts = await retrieve_excerpts(db, book.id, question)
    if not excerpts:
        return {
            "answer": (
                "I couldn't find passages in this book that speak to that question. "
                "Try asking about something the book covers more directly."
            ),
            "excerpts": [],
        }

    excerpt_text = "\n\n".join(
        f"[{e.chapter_title}]\n{e.snippet}" for e in excerpts
    )
    user = (
        f"USER QUESTION:\n{question}\n\n"
        f"RELEVANT EXCERPTS FROM \"{book.title}\":\n\n{excerpt_text}"
    )
    system = build_system(
        (CHAT_AGENT, True),
        (f"BOOK: {book.title} by {book.author or 'Unknown'}.", True),
    )
    answer = call_claude(system=system, user=user, fast=False, max_tokens=900)
    return {
        "answer": answer,
        "excerpts": [
            {"chapter": e.chapter_title, "score": round(e.score, 3)} for e in excerpts
        ],
    }

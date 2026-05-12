import uuid
from typing import Sequence

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import Settings, get_settings
from app.db import get_session
from app.models import Book, BookStatus, Pace, ReadingPlan, User
from app.rate_limit import enforce as enforce_rate_limit
from app.schemas.book import BookCreate, BookOut, UploadCredentials
from app.schemas.plan import PlanOut
from app.storage import presigned_put

router = APIRouter(prefix="/books", tags=["books"])

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/epub+zip",
}


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)


class PlanAsIsRequest(BaseModel):
    minutes_per_session: int = Field(default=12, ge=5, le=120)
    pace: Pace = Pace.steady


class ChatExcerptOut(BaseModel):
    chapter: str
    score: float


class ChatResponse(BaseModel):
    answer: str
    excerpts: list[ChatExcerptOut]


@router.get("", response_model=list[BookOut])
async def list_books(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> Sequence[Book]:
    result = await db.execute(
        select(Book).where(Book.user_id == user.id).order_by(Book.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{book_id}", response_model=BookOut)
async def get_book(
    book_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> Book:
    book = await db.get(Book, book_id)
    if book is None or book.user_id != user.id:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


@router.post("/upload", response_model=UploadCredentials, status_code=status.HTTP_201_CREATED)
async def create_upload(
    payload: BookCreate,
    user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_session),
) -> UploadCredentials:
    """Reserve a Book row and return a presigned R2 URL the client uploads to directly."""
    if payload.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported file type")
    if not settings.storage_configured:
        raise HTTPException(status_code=503, detail="Storage backend not configured")

    book = Book(
        user_id=user.id,
        title=payload.title,
        author=payload.author,
        content_type=payload.content_type,
        size_bytes=payload.size_bytes,
        status=BookStatus.pending,
    )
    db.add(book)
    await db.flush()  # populate book.id

    storage_key = f"users/{user.id}/books/{book.id}/source"
    book.storage_key = storage_key
    await db.commit()
    await db.refresh(book)

    expires = 900
    upload_url = presigned_put(storage_key, payload.content_type, expires=expires)
    return UploadCredentials(
        book_id=book.id,
        upload_url=upload_url,
        storage_key=storage_key,
        expires_in=expires,
    )


@router.post("/{book_id}/process", response_model=BookOut, status_code=status.HTTP_202_ACCEPTED)
async def process_book(
    book_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> Book:
    """Queue an async job to parse the uploaded source into chapters.

    On success, the worker chains analyze_book automatically when AI providers
    are configured (Phase 5 — embeddings + concept + style).
    """
    book = await db.get(Book, book_id)
    if book is None or book.user_id != user.id:
        raise HTTPException(status_code=404, detail="Book not found")
    if not book.storage_key:
        raise HTTPException(status_code=409, detail="No source uploaded yet")
    if book.status == BookStatus.parsing:
        return book  # idempotent — caller can poll

    book.status = BookStatus.pending
    book.error_message = None
    await db.commit()
    await db.refresh(book)

    from app.tasks import parse_book as parse_book_task

    parse_book_task.delay(str(book.id))
    return book


@router.post("/{book_id}/analyze", response_model=BookOut, status_code=status.HTTP_202_ACCEPTED)
async def analyze_book_endpoint(
    book_id: uuid.UUID,
    user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_session),
) -> Book:
    """Re-run the AI analysis pass for a book that has already been parsed.

    Useful when you change AI prompts/models and want to refresh embeddings,
    concepts, and the style profile. Normally chained automatically after parse.
    """
    book = await db.get(Book, book_id)
    if book is None or book.user_id != user.id:
        raise HTTPException(status_code=404, detail="Book not found")
    if book.status != BookStatus.ready:
        raise HTTPException(
            status_code=409, detail=f"Book is not ready (status={book.status})"
        )
    if not (settings.claude_configured and settings.embeddings_configured):
        raise HTTPException(
            status_code=503,
            detail="AI providers not configured (set ANTHROPIC_API_KEY and VOYAGE_API_KEY)",
        )

    from app.tasks import analyze_book as analyze_book_task

    analyze_book_task.delay(str(book.id))
    return book


@router.post("/{book_id}/plan-as-is", response_model=PlanOut, status_code=status.HTTP_201_CREATED)
async def create_plan_as_is(
    book_id: uuid.UUID,
    payload: PlanAsIsRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> PlanOut:
    """Build a reading plan from the book's parsed chapters with no AI rewriting.

    Fast (synchronous), free of token spend, and preserves the author's exact
    words. The Reader renders the result with the same prose-block shape as
    AI-paced plans, so the UX is identical from there on.
    """
    book = await db.get(Book, book_id)
    if book is None or book.user_id != user.id:
        raise HTTPException(status_code=404, detail="Book not found")
    if book.status != BookStatus.ready:
        raise HTTPException(
            status_code=409,
            detail=f"Book is not ready ({book.status}); finish processing first",
        )

    # Sync work via a fresh sync session — we don't want to leak the async
    # session into the worker-style code path. Cheap (just text wrangling).
    from app.worker import SyncSessionLocal
    from app.services.plan_as_is import build_plan_as_is

    def _do_build() -> uuid.UUID:
        with SyncSessionLocal() as sdb:
            plan = build_plan_as_is(
                book_id=book.id,
                user_id=user.id,
                minutes_per_session=payload.minutes_per_session,
                pace=payload.pace,
                db=sdb,
            )
            return plan.id

    import asyncio

    plan_id = await asyncio.to_thread(_do_build)
    plan = await db.get(ReadingPlan, plan_id)
    if plan is None:
        raise HTTPException(status_code=500, detail="Plan create failed")
    return PlanOut.model_validate(plan)


@router.post("/{book_id}/chat", response_model=ChatResponse)
async def chat_with_book(
    book_id: uuid.UUID,
    payload: ChatRequest,
    user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_session),
) -> ChatResponse:
    """Grounded RAG chat over the book's chapter embeddings."""
    book = await db.get(Book, book_id)
    if book is None or book.user_id != user.id:
        raise HTTPException(status_code=404, detail="Book not found")
    if not (settings.claude_configured and settings.embeddings_configured):
        raise HTTPException(
            status_code=503,
            detail="AI providers not configured (set ANTHROPIC_API_KEY and VOYAGE_API_KEY)",
        )

    enforce_rate_limit(key=f"chat:{user.id}", limit=15, window_sec=60)

    # Lazy import: keeps the API process from importing AI deps at startup
    # if they're not strictly needed for the route in question.
    from app.ai.rag import answer_question

    result = await answer_question(db, book, payload.question)
    return ChatResponse(
        answer=result["answer"],
        excerpts=[ChatExcerptOut(**e) for e in result["excerpts"]],
    )

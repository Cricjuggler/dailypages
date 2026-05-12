from uuid import UUID

from pydantic import BaseModel, Field

from app.models.book import BookStatus
from app.schemas.common import CoverParams, TimestampedOut


class BookCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    author: str | None = Field(default=None, max_length=255)
    content_type: str = Field(
        description="MIME type of the source file (application/pdf, application/epub+zip, ...)"
    )
    size_bytes: int | None = Field(default=None, ge=0, le=200 * 1024 * 1024)


class UploadCredentials(BaseModel):
    book_id: UUID
    upload_url: str
    storage_key: str
    expires_in: int


class BookOut(TimestampedOut):
    user_id: UUID
    title: str
    author: str | None = None
    pages: int | None = None
    status: BookStatus
    cover_params: CoverParams | None = None
    cover_url: str | None = None
    error_message: str | None = None

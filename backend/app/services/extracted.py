"""Common shapes returned by extractors."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ExtractedChapter:
    ordinal: int
    title: str
    content: str

    def __post_init__(self) -> None:
        self.content = self.content.strip()


@dataclass
class ExtractedBook:
    title: str | None
    author: str | None
    pages: int | None
    chapters: list[ExtractedChapter] = field(default_factory=list)

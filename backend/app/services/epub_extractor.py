"""EPUB extraction via ebooklib.

EPUBs are basically zipped HTML — chapter structure is usually clean enough that
we can take chapters straight from the spine in order, falling back to the TOC
when the spine is sparse.
"""
from __future__ import annotations

import io
import logging
from dataclasses import dataclass

from bs4 import BeautifulSoup
from ebooklib import ITEM_DOCUMENT, epub

from app.services.extracted import ExtractedBook, ExtractedChapter

log = logging.getLogger(__name__)


@dataclass
class _EpubChunk:
    title: str | None
    href: str
    html: str


def _html_to_text(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    # Strip non-prose elements outright.
    for tag in soup(["script", "style", "nav", "header", "footer"]):
        tag.decompose()
    text = soup.get_text(separator="\n")
    lines = [ln.strip() for ln in text.splitlines()]
    return "\n".join(ln for ln in lines if ln).strip()


def _walk_toc(toc, out: dict[str, str] | None = None) -> dict[str, str]:
    """Flatten EPUB TOC into {href: title}. Hrefs may include fragments."""
    if out is None:
        out = {}
    for item in toc:
        if isinstance(item, tuple):
            section, children = item
            if section.href:
                href = section.href.split("#", 1)[0]
                out.setdefault(href, section.title or "")
            _walk_toc(children, out)
        else:
            if getattr(item, "href", None):
                href = item.href.split("#", 1)[0]
                out.setdefault(href, item.title or "")
    return out


def extract_epub(data: bytes) -> ExtractedBook:
    book = epub.read_epub(io.BytesIO(data))
    title_meta = book.get_metadata("DC", "title")
    creator_meta = book.get_metadata("DC", "creator")
    title = (title_meta[0][0] if title_meta else None) or None
    author = (creator_meta[0][0] if creator_meta else None) or None

    toc_titles = _walk_toc(book.toc)
    items_by_href = {item.file_name: item for item in book.get_items_of_type(ITEM_DOCUMENT)}

    # Spine order is the canonical reading order.
    chunks: list[_EpubChunk] = []
    for spine_id, _linear in book.spine:
        item = book.get_item_with_id(spine_id)
        if item is None or item.get_type() != ITEM_DOCUMENT:
            continue
        html = item.get_content().decode("utf-8", errors="replace")
        title_for_chunk = toc_titles.get(item.file_name) or None
        chunks.append(_EpubChunk(title=title_for_chunk, href=item.file_name, html=html))

    # Fallback: if the spine produced nothing, walk all document items.
    if not chunks:
        for href, item in items_by_href.items():
            html = item.get_content().decode("utf-8", errors="replace")
            chunks.append(_EpubChunk(title=toc_titles.get(href), href=href, html=html))

    chapters: list[ExtractedChapter] = []
    for i, chunk in enumerate(chunks):
        text = _html_to_text(chunk.html)
        if len(text) < 200:
            # Skip front-matter, copyright pages, blank chunks
            continue
        chapter_title = chunk.title or f"Chapter {len(chapters) + 1}"
        chapters.append(
            ExtractedChapter(ordinal=len(chapters) + 1, title=chapter_title, content=text)
        )

    return ExtractedBook(title=title, author=author, pages=None, chapters=chapters)

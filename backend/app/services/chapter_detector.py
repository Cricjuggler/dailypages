"""Heuristic chapter detection from a full text body.

Runs on PDFs that have no usable outline. We look for common chapter markers
and split on them. If no markers fire, we fall back to evenly-sized chunks so
downstream code (planning, rewriting) always has something to work with.
"""
from __future__ import annotations

import re

from app.services.extracted import ExtractedChapter

_HEADING_PATTERNS = [
    re.compile(r"^\s*(CHAPTER|Chapter)\s+(?P<num>[IVXLC\d]+)(?:\s*[\.\:\—\-]\s*(?P<title>.+))?\s*$"),
    re.compile(r"^\s*(BOOK|Book)\s+(?P<num>[IVXLC\d]+)(?:\s*[\.\:\—\-]\s*(?P<title>.+))?\s*$"),
    re.compile(r"^\s*(?P<num>\d+)\.\s+(?P<title>[A-Z][^\n]{3,80})\s*$"),
]

_MIN_CHAPTER_CHARS = 600
_MAX_FALLBACK_CHUNKS = 24


def _split_on_headings(text: str) -> list[ExtractedChapter]:
    matches: list[tuple[int, str]] = []
    for line_match in re.finditer(r"^[^\n]+$", text, flags=re.MULTILINE):
        line = line_match.group(0).strip()
        if not line or len(line) > 120:
            continue
        for pat in _HEADING_PATTERNS:
            m = pat.match(line)
            if not m:
                continue
            label = line.strip()
            num = m.groupdict().get("num")
            title_part = (m.groupdict().get("title") or "").strip()
            title = (
                f"{m.group(1)} {num}: {title_part}" if num and title_part
                else (label if not title_part else f"Chapter {num or '?'}: {title_part}")
            )
            matches.append((line_match.start(), title))
            break

    if len(matches) < 3:
        return []

    chapters: list[ExtractedChapter] = []
    for i, (start, title) in enumerate(matches):
        end = matches[i + 1][0] if i + 1 < len(matches) else len(text)
        body = text[start:end].strip()
        if len(body) < _MIN_CHAPTER_CHARS:
            continue
        chapters.append(
            ExtractedChapter(ordinal=len(chapters) + 1, title=title, content=body)
        )
    return chapters


def _split_evenly(text: str) -> list[ExtractedChapter]:
    text = text.strip()
    if not text:
        return []
    # Aim for ~3,000-char chunks but cap chunk count.
    target = max(3000, len(text) // _MAX_FALLBACK_CHUNKS)
    chunks: list[ExtractedChapter] = []
    paragraphs = re.split(r"\n{2,}", text)
    buf: list[str] = []
    cursor = 0
    for p in paragraphs:
        buf.append(p)
        cursor += len(p) + 2
        if cursor >= target:
            content = "\n\n".join(buf).strip()
            if content:
                chunks.append(
                    ExtractedChapter(
                        ordinal=len(chunks) + 1,
                        title=f"Section {len(chunks) + 1}",
                        content=content,
                    )
                )
            buf, cursor = [], 0
        if len(chunks) >= _MAX_FALLBACK_CHUNKS - 1:
            break
    if buf:
        content = "\n\n".join(buf).strip()
        if content:
            chunks.append(
                ExtractedChapter(
                    ordinal=len(chunks) + 1,
                    title=f"Section {len(chunks) + 1}",
                    content=content,
                )
            )
    return chunks


def detect_chapters_from_text(text: str) -> list[ExtractedChapter]:
    by_heading = _split_on_headings(text)
    if by_heading:
        return by_heading
    return _split_evenly(text)

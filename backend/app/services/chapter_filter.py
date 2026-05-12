"""Shared front-matter filtering.

PDF outlines and EPUB spines over-extract: they emit Cover, Title Page,
Copyright, Contents, Dedication, Notes, Index, etc. as "chapters". These
have no narrative value and waste analyze/plan tokens. We drop them by
title heuristics + minimum content length.
"""
from __future__ import annotations

from collections.abc import Iterable
from typing import TypeVar

FRONTMATTER_TITLES = {
    "cover",
    "title page",
    "title",
    "copyright",
    "contents",
    "table of contents",
    "dedication",
    "epigraph",
    "foreword",
    "preface",
    "introduction by",
    "acknowledgments",
    "acknowledgements",
    "about the author",
    "about the authors",
    "about the book",
    "notes",
    "endnotes",
    "footnotes",
    "bibliography",
    "references",
    "index",
    "credits",
    "colophon",
    "appendix",
    "glossary",
    "advance praise",
    "praise for",
    "also by",
    "by the same author",
}

MIN_CHAPTER_CHARS = 1500

T = TypeVar("T")


def _title_is_frontmatter(title: str) -> bool:
    t = (title or "").strip().lower()
    if t in FRONTMATTER_TITLES:
        return True
    # Prefix matches catch "Introduction by Some Person", "About the Author —"
    for prefix in ("introduction by", "about the author", "praise for", "also by"):
        if t.startswith(prefix):
            return True
    return False


def filter_real_chapters(
    chapters: Iterable[T], get_title: callable, get_content: callable
) -> list[T]:
    """Drop front-matter and very short chapters. Caller passes accessors."""
    return [
        c
        for c in chapters
        if not _title_is_frontmatter(get_title(c)) and len(get_content(c) or "") >= MIN_CHAPTER_CHARS
    ]

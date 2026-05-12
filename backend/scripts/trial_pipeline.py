"""End-to-end AI pipeline trial against a real PDF.

UTF-8 stdout — Windows console defaults to cp1252 which blows up on em dashes
and checkmarks. Reconfigure once at import time.
"""
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    _sys.stderr.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
except Exception:
    pass

"""End-to-end AI pipeline trial against a real PDF.

Runs the full agent chain in-process, no Postgres / Redis / Celery / Clerk / R2.
Cost-capped: caps which chapters get analyzed and rewrites only one session.

Usage:
    python scripts/trial_pipeline.py "C:/path/to/book.pdf"

Optional flags:
    --max-chapters N      Only analyze first N chapters (default: 3)
    --rewrite-session N   Which session number to rewrite (default: 1)
    --depth quick|balanced|deep  (default: balanced)
    --pace sprint|steady|gentle  (default: steady)
    --minutes M           Minutes per session (default: 12)
    --target-sessions N   Plan target (default: 12)
    --skip-rewrite        Skip the Opus rewrite step (saves ~$0.30)
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path


def load_env(path: Path) -> None:
    """Load .env, overriding empty pre-existing env vars but not real ones."""
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        key, val = k.strip(), v.strip()
        existing = os.environ.get(key)
        if existing is None or existing == "":
            os.environ[key] = val


def banner(msg: str) -> None:
    bar = "=" * (len(msg) + 2)
    print(f"\n+{bar}+\n| {msg} |\n+{bar}+")


def section(msg: str) -> None:
    print(f"\n-- {msg} " + "-" * max(0, 60 - len(msg)))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf_path")
    parser.add_argument("--max-chapters", type=int, default=3)
    parser.add_argument("--rewrite-session", type=int, default=1)
    parser.add_argument("--depth", default="balanced", choices=["quick", "balanced", "deep"])
    parser.add_argument("--pace", default="steady", choices=["sprint", "steady", "gentle"])
    parser.add_argument("--minutes", type=int, default=12)
    parser.add_argument("--target-sessions", type=int, default=12)
    parser.add_argument("--skip-rewrite", action="store_true")
    args = parser.parse_args()

    pdf_path = Path(args.pdf_path)
    if not pdf_path.exists():
        print(f"ERROR: PDF not found: {pdf_path}")
        return 1

    backend_root = Path(__file__).resolve().parent.parent
    load_env(backend_root / ".env")
    sys.path.insert(0, str(backend_root))

    if not (os.environ.get("ANTHROPIC_API_KEY") and os.environ.get("VOYAGE_API_KEY")):
        print("ERROR: ANTHROPIC_API_KEY and VOYAGE_API_KEY must be set in backend/.env")
        return 1

    # Lazy imports so missing deps surface here, not at import time.
    from app.ai.agents.planner import ChapterMeta, plan_sessions
    from app.ai.agents.quiz import generate_quiz
    from app.ai.agents.rewriter import rewrite_session
    from app.ai.agents.semantic import analyze_chapters
    from app.ai.agents.style import analyze_style
    from app.services.pdf_extractor import extract_pdf

    banner("DailyPages — AI pipeline trial")
    print(f"PDF:    {pdf_path.name}")
    print(f"Size:   {pdf_path.stat().st_size / 1024 / 1024:.2f} MB")

    # ---------- 1. Parse (cached) ----------
    section("1/6  Parsing PDF")
    import json
    import pickle

    cache_dir = backend_root / ".trial_cache"
    cache_dir.mkdir(exist_ok=True)
    cache_file = cache_dir / f"{pdf_path.stem}.pkl"
    t0 = time.time()
    if cache_file.exists() and cache_file.stat().st_mtime > pdf_path.stat().st_mtime:
        with cache_file.open("rb") as f:
            extracted = pickle.load(f)
        print(f"  cache hit -> {cache_file.name}")
    else:
        print(f"  parsing fresh (this can take a few minutes for a long book)…")
        data = pdf_path.read_bytes()
        extracted = extract_pdf(data)
        with cache_file.open("wb") as f:
            pickle.dump(extracted, f)
        print(f"  cached -> {cache_file.name}")
    print(f"  pages:    {extracted.pages}")
    print(f"  title:    {extracted.title or '(none in metadata)'}")
    print(f"  author:   {extracted.author or '(none in metadata)'}")
    print(f"  chapters: {len(extracted.chapters)}")
    if not extracted.chapters:
        print("ERROR: no chapters extracted")
        return 2
    print(f"  elapsed:  {time.time() - t0:.1f}s")

    print("  preview:")
    for c in extracted.chapters[:5]:
        print(f"    {c.ordinal:>3}. {c.title[:70]} ({len(c.content)} chars)")
    if len(extracted.chapters) > 5:
        print(f"    … and {len(extracted.chapters) - 5} more")

    book_meta = {
        "title": extracted.title or pdf_path.stem,
        "author": extracted.author or "Unknown",
    }

    # ---------- 2. Semantic (embeddings + concepts) on first N chapters ----------
    section(f"2/6  Semantic analysis (first {args.max_chapters} chapters)")
    t0 = time.time()
    chapters_to_analyze = extracted.chapters[: args.max_chapters]
    texts = [c.content for c in chapters_to_analyze]
    analyses = analyze_chapters(texts, book_meta)
    print(f"  embedded {len(analyses)} chapters")
    print(f"  elapsed: {time.time() - t0:.1f}s")
    for i, (ch, a) in enumerate(zip(chapters_to_analyze, analyses, strict=False), start=1):
        print(f"\n  [{i}] {ch.title[:60]}")
        print(f"      complexity={a.complexity:.2f}  importance={a.importance:.2f}")
        print(f"      embedding dim={len(a.embedding)}")
        for c in a.concepts[:3]:
            name = c.get("name", "?")
            defn = (c.get("definition") or "")[:80]
            print(f"      - {name}: {defn}")

    # ---------- 3. Style profile ----------
    section("3/6  Style profile")
    t0 = time.time()
    style = analyze_style([c.content for c in chapters_to_analyze], book_meta)
    print(f"  elapsed: {time.time() - t0:.1f}s")
    print(f"  tone:           {style.get('tone')}")
    print(f"  rhythm:         {style.get('sentence_rhythm')}")
    print(f"  vocabulary:     {style.get('vocabulary')}")
    voice = (style.get("voice_summary") or "").strip().replace("\n", " ")
    print(f"  voice_summary:  {voice[:200]}")
    samples = style.get("sample_phrases") or []
    if samples:
        print(f"  sample_phrases: {samples[:3]}")

    # ---------- 4. Session planner ----------
    section("4/6  Session planner")

    # Filter front-matter / non-content chapters that the PDF outline picks up.
    FRONTMATTER_TITLES = {
        "cover", "title page", "title", "copyright", "contents",
        "table of contents", "dedication", "epigraph", "foreword",
        "preface", "acknowledgments", "acknowledgements", "about the author",
        "about the authors", "notes", "bibliography", "index", "credits",
    }
    real_chapters = [
        c for c in extracted.chapters
        if c.title.strip().lower() not in FRONTMATTER_TITLES
        and len(c.content) >= 1500
    ]
    print(f"  filtered: {len(extracted.chapters)} -> {len(real_chapters)} real chapters")

    t0 = time.time()
    chapter_metas = []
    for i, c in enumerate(real_chapters, start=1):
        body_len = len(c.content)
        minutes = max(1, round(body_len / 1000 * 4))
        complexity = 0.5
        if i <= len(analyses):
            complexity = analyses[i - 1].complexity
        chapter_metas.append(
            ChapterMeta(
                ordinal=c.ordinal,
                title=c.title,
                length_minutes=minutes,
                complexity=complexity,
            )
        )
    boundaries = plan_sessions(
        chapter_metas,
        target_sessions=args.target_sessions,
        minutes_per_session=args.minutes,
        pace=args.pace,
        depth=args.depth,
    )
    print(f"  elapsed: {time.time() - t0:.1f}s")
    print(f"  planned {len(boundaries)} sessions:")
    for b in boundaries[:8]:
        ranges = ", ".join(
            f"ch{r.get('chapter_ordinal')}:{r.get('start_paragraph', 0)}-{r.get('end_paragraph', '?')}"
            for r in b.source_ranges[:3]
        )
        print(f"    {b.session_number:>2}. {b.title[:55]} ({b.estimated_minutes}min) [{ranges}]")
    if len(boundaries) > 8:
        print(f"    … and {len(boundaries) - 8} more")

    # ---------- 5. Rewriter on ONE session ----------
    if args.skip_rewrite:
        print("\n[skipping rewriter — --skip-rewrite]")
        return 0

    section(f"5/6  Rewriter (Opus) — session {args.rewrite_session}")
    target = next((b for b in boundaries if b.session_number == args.rewrite_session), None)
    if target is None:
        print(f"  no session {args.rewrite_session} found in plan")
        return 0

    chapters_by_ordinal = {c.ordinal: c for c in real_chapters}
    parts: list[str] = []
    for r in target.source_ranges:
        ord_ = r.get("chapter_ordinal")
        if ord_ is None or int(ord_) not in chapters_by_ordinal:
            continue
        chap = chapters_by_ordinal[int(ord_)]
        body = chap.content
        paras = [p for p in body.split("\n\n") if p.strip()]
        sp = max(0, int(r.get("start_paragraph", 0)))
        ep = int(r.get("end_paragraph", -1))
        if ep < 0 or ep > len(paras):
            ep = len(paras)
        parts.append("\n\n".join(paras[sp:ep]))
    source_text = "\n\n".join(p for p in parts if p)
    if not source_text:
        # Fall back to chapter 1 if planner gave us empty ranges
        source_text = extracted.chapters[0].content
    # Cap source so we don't blow context budget
    if len(source_text) > 16000:
        source_text = source_text[:16000] + "\n…"
    print(f"  source: {len(source_text)} chars")

    t0 = time.time()
    blocks = rewrite_session(
        source_text=source_text,
        style_profile=style,
        book_meta=book_meta,
        session_number=target.session_number,
        sessions_total=len(boundaries),
        chapter_label=target.chapter_label,
        estimated_minutes=target.estimated_minutes,
        depth=args.depth,
    )
    print(f"  elapsed: {time.time() - t0:.1f}s")
    print(f"  produced {len(blocks)} blocks:")
    kinds = [b.get("kind") for b in blocks]
    print(f"  kinds:   {kinds}")
    print("\n  RENDERED PREVIEW:\n")
    for b in blocks:
        kind = b.get("kind")
        if kind == "intro":
            print(f"  [intro] eyebrow: {b.get('eyebrow', '')}")
            print(f"          title:   {b.get('title', '')}")
            print(f"          meta:    {b.get('meta', '')}")
        elif kind == "p":
            txt = (b.get("text") or "").strip()
            mark = "[p" + (" dropcap" if b.get("dropcap") else "") + "] "
            tail = "..." if len(txt) > 280 else ""
            print(f"\n  {mark}{txt[:280]}{tail}")
        elif kind == "pullquote":
            print(f"\n  [pullquote] \"{(b.get('text') or '').strip()[:200]}\"")
        elif kind == "h2":
            print(f"\n  [h2] ## {b.get('text', '')}")
        elif kind == "section-mark":
            print(f"\n  [section-mark] . . .")
        elif kind == "outro":
            print(f"\n  [outro] end of session")

    # ---------- 6. Quiz / recap ----------
    section("6/6  Quiz + recap")
    t0 = time.time()
    rq = generate_quiz(session_blocks=blocks, book_meta=book_meta, session_title=target.title)
    print(f"  elapsed: {time.time() - t0:.1f}s")
    print("\n  TAKEAWAYS:")
    for i, t in enumerate(rq.get("takeaways", []), start=1):
        print(f"    {i:>2}. {t}")
    print("\n  QUIZ:")
    for q in rq.get("quiz", []):
        print(f"    Q: {q.get('q')}")
        for i, c in enumerate(q.get("choices", [])):
            mark = "*" if i == q.get("correct") else " "
            print(f"      {mark} {chr(65 + i)}. {c}")
    if rq.get("next_preview"):
        print(f"\n  NEXT: {rq['next_preview']}")

    # Dump full results to JSON for inspection (no re-run needed).
    import json
    out_path = backend_root / ".trial_cache" / f"{pdf_path.stem}.results.json"
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(
            {
                "book": book_meta,
                "style_profile": style,
                "sessions": [
                    {
                        "session_number": b.session_number,
                        "title": b.title,
                        "chapter_label": b.chapter_label,
                        "estimated_minutes": b.estimated_minutes,
                        "source_ranges": b.source_ranges,
                    }
                    for b in boundaries
                ],
                "rewritten_session": {
                    "number": target.session_number,
                    "title": target.title,
                    "blocks": blocks,
                },
                "quiz": rq,
            },
            f,
            indent=2,
            ensure_ascii=False,
        )
    print(f"\n  full results saved to: {out_path}")

    print("\n" + "=" * 64)
    print("  Pipeline complete. AI layer verified end-to-end.")
    print("=" * 64)
    return 0


if __name__ == "__main__":
    sys.exit(main())

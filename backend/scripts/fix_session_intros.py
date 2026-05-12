"""Patch existing session intro blocks to reflect updated book.title/author.

The rewriter snapshots book metadata into each session's intro block at
generation time. If the book metadata is later corrected, existing sessions
keep the stale values. This script rewrites the `meta` line of each intro
block based on the current Book row.

Usage:
    python scripts/fix_session_intros.py <plan_id>
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

from app.models import Book, ReadingPlan, Session  # noqa: E402
from app.worker import SyncSessionLocal  # noqa: E402


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: python scripts/fix_session_intros.py <plan_id>")
        return 1
    plan_id = sys.argv[1]
    with SyncSessionLocal() as db:
        plan = db.execute(select(ReadingPlan).where(ReadingPlan.id == plan_id)).scalar_one()
        book = db.get(Book, plan.book_id)
        if book is None:
            print(f"book {plan.book_id} not found")
            return 2
        author = (book.author or "").strip()
        sessions = (
            db.execute(
                select(Session)
                .where(Session.reading_plan_id == plan.id)
                .order_by(Session.session_number)
            )
            .scalars()
            .all()
        )
        patched = 0
        for s in sessions:
            blocks = s.content_blocks or []
            changed = False
            for b in blocks:
                if isinstance(b, dict) and b.get("kind") == "intro":
                    new_meta = (
                        f"{author} · {s.chapter or ''} · ~{s.estimated_minutes} min".strip(" ·")
                    )
                    if b.get("meta") != new_meta:
                        b["meta"] = new_meta
                        changed = True
            if changed:
                s.content_blocks = blocks
                flag_modified(s, "content_blocks")
                patched += 1
        db.commit()
        print(f"patched {patched}/{len(sessions)} session intros")
    return 0


if __name__ == "__main__":
    sys.exit(main())

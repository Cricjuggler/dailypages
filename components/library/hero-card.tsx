"use client";

import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { Ring } from "@/components/ui/ring";
import { BookCover } from "@/components/book-cover";
import { ArrowRight, Clock, Flame, Spark } from "@/components/icons";
import { StreakSpark } from "@/components/library/streak-spark";
import type { ActiveBook, StreakDay, Stats } from "@/lib/types";

export function HeroCard({
  book,
  days,
  stats,
}: {
  book: ActiveBook;
  days: StreakDay[];
  stats: Stats;
}) {
  const remaining = book.plan.sessionsTotal - book.plan.sessionsDone;
  const remainingMin = remaining * book.plan.minutesPerSession;
  const pct = Math.round(book.progress * 100);

  return (
    <Card className="mb-12 overflow-hidden p-0">
      <div className="grid hero-grid" style={{ gridTemplateColumns: "minmax(0,1fr) 280px" }}>
        {/* Left — today's session */}
        <div className="px-9 pt-8 pb-7 max-md:px-6">
          <div className="mb-3.5 flex flex-wrap items-center gap-2">
            <Chip variant="accent">
              <Spark size={12} /> Today&rsquo;s session
            </Chip>
            <Chip>
              <Clock size={12} /> {book.todaySession.readingTime} min
            </Chip>
          </div>

          <div className="mb-5 flex items-start gap-4">
            <BookCover book={book} w={64} h={92} fontScale={0.85} />
            <div className="min-w-0 flex-1">
              <div className="eyebrow mb-1">
                {book.title} · {book.todaySession.chapter}
              </div>
              <h2 className="display mb-2 text-[28px]">{book.todaySession.title}</h2>
              <p className="text-[13.5px] leading-[1.55] text-ink-2">
                Three short passages on the inner retreat — what it means to return to oneself,
                and why the present moment is the only ground we live on.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <Link href="/reader">
              <Button variant="accent">
                Begin reading <ArrowRight />
              </Button>
            </Link>
            <div className="flex flex-wrap items-center gap-3 text-[12.5px] text-ink-2">
              <span>
                <b className="tnum text-ink">{book.plan.sessionsDone}</b> of{" "}
                {book.plan.sessionsTotal} sessions
              </span>
              <span className="opacity-40">·</span>
              <span>
                Finish by <b className="text-ink">{book.plan.finishBy}</b>
              </span>
              <span className="opacity-40">·</span>
              <Link href="/plan" className="text-ink-2 hover:text-ink">
                See plan
              </Link>
            </div>
          </div>
        </div>

        {/* Right — progress rail */}
        <div
          className="hero-rail flex flex-col justify-between border-l border-line bg-bg-sunk px-7 py-7 max-md:border-l-0 max-md:border-t"
        >
          <div>
            <div className="eyebrow mb-3.5">Progress</div>
            <div className="flex items-center gap-4">
              <Ring value={book.progress} size={68} label={`${pct}%`} />
              <div>
                <div className="font-serif text-[18px]">{remaining} sessions</div>
                <div className="mt-0.5 text-[12px] text-ink-2">
                  ≈ {remainingMin} min remaining
                </div>
              </div>
            </div>
          </div>

          <div className="mt-7">
            <div className="mb-2 flex items-center justify-between">
              <span className="eyebrow">Streak</span>
              <span className="flex items-center gap-1 text-[12.5px] font-medium text-accent">
                <Flame size={13} /> {stats.streak} days
              </span>
            </div>
            <StreakSpark days={days.slice(-21)} />
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 720px) {
          .hero-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>
    </Card>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Flame } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { ActiveBook, QuizItem, Recap, Stats } from "@/lib/types";

type Props = {
  recap: Recap;
  book: ActiveBook;
  stats: Stats;
};

export function RecapView({ recap, book, stats }: Props) {
  const router = useRouter();
  const [answers, setAnswers] = React.useState<Record<number, number>>({});
  const [revealed, setRevealed] = React.useState(false);

  return (
    <div className="container-narrow mx-auto w-full max-w-[720px] animate-fade-up px-7 pt-[60px] pb-20 max-md:px-4">
      <div className="mb-9 text-center">
        <div className="eyebrow mb-3">Session {book.todaySession.number} · Complete</div>
        <h1 className="display mb-2 text-[40px]">Well read.</h1>
        <p className="font-serif text-[15px] italic text-ink-2">
          {book.todaySession.readingTime} minutes spent inside an inner retreat.
        </p>
      </div>

      {/* Streak callout */}
      <Card
        className="mb-8 border-transparent px-6 py-5"
        style={{ background: "var(--accent-tint)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-white">
              <Flame size={20} />
            </div>
            <div>
              <div className="font-serif text-[17px]">{stats.streak + 1}-day streak</div>
              <div className="text-[12.5px] text-ink-2">You&rsquo;ve read every day this week.</div>
            </div>
          </div>
          <div className="tnum text-[12px] text-ink-2">Best: {stats.bestStreak} days</div>
        </div>
      </Card>

      {/* Takeaways */}
      <h2 className="display mb-4 text-[22px]">What stayed</h2>
      <Card className="mb-9 py-2">
        {recap.takeaways.map((t, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-3.5 px-[22px] py-4",
              i !== recap.takeaways.length - 1 && "border-b border-line",
            )}
          >
            <div className="w-[22px] shrink-0 font-serif text-[22px] leading-none text-accent">
              {String(i + 1).padStart(2, "0")}
            </div>
            <div className="font-serif text-[15.5px] leading-[1.55]" style={{ textWrap: "pretty" }}>
              {t}
            </div>
          </div>
        ))}
      </Card>

      {/* Quiz */}
      <h2 className="display mb-1.5 text-[22px]">A few to keep</h2>
      <p className="mb-4 text-[13px] text-ink-2">Brief recall — no pressure, no scoring.</p>

      <div className="mb-9 flex flex-col gap-4">
        {recap.quiz.map((q, i) => (
          <QuizCard
            key={i}
            q={q}
            idx={i}
            value={answers[i]}
            revealed={revealed}
            onAnswer={(v) => setAnswers((a) => ({ ...a, [i]: v }))}
          />
        ))}
      </div>

      <div className="mb-12 flex flex-wrap items-center justify-between gap-3">
        {!revealed ? (
          <Button variant="ghost" onClick={() => setRevealed(true)}>
            Reveal answers
          </Button>
        ) : (
          <span className="font-serif text-[13px] italic text-ink-2">
            Spaced repetition will return these in a few days.
          </span>
        )}
      </div>

      {/* Next session */}
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="eyebrow mb-1.5">
              Tomorrow · Session {recap.nextSession.number}
            </div>
            <div className="mb-1 font-serif text-[22px]">{recap.nextSession.title}</div>
            <div className="text-[13px] text-ink-2">
              {recap.nextSession.readingTime} min · {book.title}, Book IV
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => router.push("/progress")}>
              See progress
            </Button>
            <Button variant="accent" onClick={() => router.push("/")}>
              Done for today <Check />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function QuizCard({
  q,
  idx,
  value,
  revealed,
  onAnswer,
}: {
  q: QuizItem;
  idx: number;
  value: number | undefined;
  revealed: boolean;
  onAnswer: (i: number) => void;
}) {
  return (
    <Card className="px-6 py-5">
      <div className="mb-3.5 flex items-start gap-3">
        <span className="eyebrow tnum mt-0.5">Q{idx + 1}</span>
        <div className="flex-1 font-serif text-[16px] leading-[1.45]">{q.q}</div>
      </div>
      <div className="flex flex-col gap-1.5">
        {q.choices.map((c, i) => {
          const selected = value === i;
          const isCorrect = i === q.correct;
          let bg = "var(--bg-elev)";
          let border = "var(--line)";
          let color = "var(--ink)";
          if (revealed) {
            if (isCorrect) {
              bg = "var(--accent-tint)";
              border = "var(--accent)";
              color = "var(--accent-2)";
            } else if (selected && !isCorrect) {
              bg = "transparent";
              border = "var(--line-2)";
              color = "var(--ink-3)";
            }
          } else if (selected) {
            border = "var(--accent)";
            color = "var(--accent-2)";
            bg = "var(--accent-tint)";
          }
          const showFill = selected || (revealed && isCorrect);
          return (
            <button
              key={i}
              onClick={() => !revealed && onAnswer(i)}
              disabled={revealed}
              style={{
                background: bg,
                color,
                border: `1px solid ${border}`,
              }}
              className="flex items-center gap-2.5 rounded-md px-3.5 py-2.5 text-left font-serif text-[14px] transition-all duration-200 disabled:cursor-default"
            >
              <span
                className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-white"
                style={{
                  border: `1px solid ${showFill ? border : "var(--line-2)"}`,
                  background: showFill ? border : "transparent",
                }}
              >
                {showFill && <Check size={10} />}
              </span>
              {c}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

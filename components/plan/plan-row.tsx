import * as React from "react";
import Link from "next/link";
import { Chip } from "@/components/ui/chip";
import { Check } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { PlanRow as PlanRowT } from "@/lib/types";

type Props = {
  session: PlanRowT;
  last: boolean;
  minutesPerSession: number;
  /** Real session UUID — when provided, the row becomes a link to the reader. */
  sessionId?: string;
};

export function PlanRow({ session, last, minutesPerSession, sessionId }: Props) {
  const isToday = session.state === "today";
  const isDone = session.state === "done";

  const rowClass = cn(
    "flex items-center gap-4 px-6 py-3.5",
    !last && "border-b border-line",
    isToday && "bg-accent-tint",
    sessionId && "transition-colors hover:bg-bg-sunk cursor-pointer",
  );

  const inner = (
    <>
      <div
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-serif text-[13px]"
        style={{
          background: isDone
            ? "var(--ink)"
            : isToday
              ? "var(--accent)"
              : "var(--bg-sunk)",
          color: isDone || isToday ? "#fff" : "var(--ink-3)",
          border: !isDone && !isToday ? "1px solid var(--line)" : "0",
        }}
      >
        {isDone ? <Check size={14} /> : session.num}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-baseline gap-2">
          <span className="eyebrow" style={{ fontSize: 9.5 }}>
            {session.chapter}
          </span>
          {isToday && (
            <Chip variant="accent" style={{ fontSize: 10, padding: "1px 8px" }}>
              Today
            </Chip>
          )}
        </div>
        <div
          className={cn("font-serif text-[15.5px]", isDone ? "text-ink-3" : "text-ink")}
        >
          {session.title}
        </div>
      </div>

      <div className={cn("tnum text-[12px] text-ink-2", isDone ? "opacity-50" : "opacity-80")}>
        {minutesPerSession} min
      </div>
    </>
  );

  if (sessionId) {
    return (
      <Link href={`/reader/${sessionId}`} className={rowClass}>
        {inner}
      </Link>
    );
  }
  return <div className={rowClass}>{inner}</div>;
}

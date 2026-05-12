import * as React from "react";
import type { WeeklyStat } from "@/lib/types";

export function WeeklyBars({ weekly }: { weekly: WeeklyStat[] }) {
  return (
    <div>
      <div className="flex items-end gap-2.5" style={{ height: 110 }}>
        {weekly.map((d, i) => {
          const h = Math.max(2, (d.min / 20) * 100);
          return (
            <div
              key={d.day}
              className="flex-1 rounded"
              style={{
                height: `${h}%`,
                background: d.min === 0 ? "var(--line)" : "var(--accent)",
                opacity: d.min === 0 ? 0.8 : 1,
                transition: `height 600ms cubic-bezier(.2,.8,.2,1) ${i * 40}ms`,
              }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex gap-2.5">
        {weekly.map((d) => (
          <div
            key={d.day}
            className="flex-1 text-center text-[10.5px] text-ink-3 tracking-[.06em]"
          >
            {d.day}
          </div>
        ))}
      </div>
    </div>
  );
}

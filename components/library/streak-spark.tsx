import * as React from "react";
import type { StreakDay } from "@/lib/types";

export function StreakSpark({ days }: { days: StreakDay[] }) {
  return (
    <div className="flex items-end gap-[3px]" style={{ height: 22 }}>
      {days.map((d, i) => {
        const h = d.state === "miss" ? 5 : d.state === "light" ? 12 : 22;
        const bg =
          d.state === "miss"
            ? "var(--line)"
            : d.state === "light"
              ? "var(--accent-tint)"
              : "var(--accent)";
        const op = d.state === "today" ? 1 : d.state === "read" ? 0.85 : 1;
        return (
          <span
            key={i}
            style={{
              width: 5,
              height: h,
              borderRadius: 1.5,
              background: bg,
              opacity: op,
            }}
          />
        );
      })}
    </div>
  );
}

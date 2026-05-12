import * as React from "react";
import type { StreakDay } from "@/lib/types";

const COLS = 10;
const ROWS = 7;

export function Heatmap({ days }: { days: StreakDay[] }) {
  const padded: (StreakDay | { state: "empty" })[] = [...days];
  while (padded.length < COLS * ROWS) padded.unshift({ state: "empty" });

  return (
    <div
      className="grid gap-[5px]"
      style={{
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        gridAutoRows: "1fr",
        aspectRatio: `${COLS} / ${ROWS}`,
      }}
    >
      {padded.map((d, i) => {
        let bg = "var(--line)";
        if (d.state === "light") bg = "var(--accent-tint)";
        if (d.state === "read") bg = "var(--accent)";
        if (d.state === "today") bg = "var(--accent)";
        if (d.state === "empty") bg = "transparent";
        return (
          <div
            key={i}
            title={"date" in d && d.date ? d.date.toLocaleDateString() : ""}
            style={{
              background: bg,
              borderRadius: 3,
              opacity: d.state === "empty" ? 0 : d.state === "today" ? 1 : 0.9,
              outline: d.state === "today" ? "1.5px solid var(--ink)" : "none",
              outlineOffset: 1,
            }}
          />
        );
      })}
    </div>
  );
}

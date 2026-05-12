import * as React from "react";
import { cn } from "@/lib/utils";

type BarProps = {
  value: number; // 0..1
  className?: string;
  height?: number;
};

export function Bar({ value, className, height = 3 }: BarProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className={cn(
        "w-full rounded-full overflow-hidden bg-line",
        className,
      )}
      style={{ height }}
    >
      <span
        className="block h-full rounded-full bg-accent"
        style={{
          width: `${pct}%`,
          transition: "width 600ms cubic-bezier(.2,.8,.2,1)",
        }}
      />
    </div>
  );
}

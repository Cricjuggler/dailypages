import * as React from "react";
import { cn } from "@/lib/utils";

type ChipProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "accent";
};

export function Chip({ className, variant = "default", ...props }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-sans",
        variant === "default" &&
          "bg-bg-elev border border-line text-ink-2",
        variant === "accent" &&
          "bg-accent-tint border border-transparent text-accent-2 dark:text-accent",
        className,
      )}
      {...props}
    />
  );
}

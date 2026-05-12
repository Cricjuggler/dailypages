import * as React from "react";
import { cn } from "@/lib/utils";

export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "bg-bg-elev border border-line rounded-lg shadow-paper",
      className,
    )}
    {...props}
  />
));
Card.displayName = "Card";

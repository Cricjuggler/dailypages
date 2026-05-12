import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "accent" | "ghost" | "quiet";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-ink text-bg-elev px-[18px] py-[11px] shadow-[0_1px_0_rgba(255,255,255,.08)_inset,0_8px_22px_-10px_rgba(0,0,0,.3)] hover:-translate-y-px hover:shadow-[0_1px_0_rgba(255,255,255,.08)_inset,0_14px_28px_-12px_rgba(0,0,0,.4)]",
  accent:
    "bg-accent text-white px-[18px] py-[11px] shadow-[0_1px_0_rgba(255,255,255,.18)_inset,0_8px_22px_-10px_var(--accent)] hover:-translate-y-px",
  ghost:
    "bg-transparent text-ink border border-line-2 px-[16px] py-[10px] hover:bg-bg-elev",
  quiet:
    "bg-transparent text-ink-2 px-[12px] py-[8px] hover:text-ink",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "ghost", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center gap-2 rounded-full font-sans text-[13.5px] font-medium tracking-[-.005em] whitespace-nowrap cursor-pointer transition-all duration-[180ms] ease-out border-0",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";

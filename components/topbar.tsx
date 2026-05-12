"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthControls } from "@/components/auth-controls";
import { LogoMark } from "@/components/icons";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Today", match: (p: string) => p === "/" || p === "/upload" || p === "/personalize" || p === "/recap" },
  { href: "/plan", label: "Plan", match: (p: string) => p === "/plan" },
  { href: "/progress", label: "Progress", match: (p: string) => p === "/progress" },
];

export function Topbar() {
  const pathname = usePathname();
  return (
    <header className="topbar sticky top-0 z-20 flex items-center justify-between border-b border-line bg-bg px-7 py-[18px] max-md:px-4">
      <Link href="/" className="brand flex items-center gap-2.5 font-serif text-lg font-medium tracking-[-.01em]">
        <span className="grid h-[22px] w-[22px] place-items-center text-accent">
          <LogoMark />
        </span>
        DailyPages
      </Link>

      <nav className="flex gap-1 max-md:hidden" aria-label="Primary">
        {NAV.map((it) => {
          const active = it.match(pathname);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "rounded-full px-3.5 py-2 text-[13px] transition-all duration-150 ease-out",
                active ? "bg-bg-elev text-ink" : "text-ink-2 hover:bg-bg-elev hover:text-ink",
              )}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3">
        <Link
          href="/upload"
          className="rounded-full px-3 py-2 text-[12.5px] text-ink-2 transition-colors hover:text-ink"
        >
          + Add book
        </Link>
        <AuthControls />
      </div>
    </header>
  );
}

"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Topbar } from "@/components/topbar";
import { TweaksPanel } from "@/components/tweaks-panel";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isReader = pathname?.startsWith("/reader");

  return (
    <div className={cn("app", isReader && "focus")}>
      {!isReader && <Topbar />}
      <main className="shell flex flex-1 flex-col min-h-0">{children}</main>
      <TweaksPanel />
    </div>
  );
}

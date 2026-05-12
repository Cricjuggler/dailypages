"use client";

import * as React from "react";
import { usePrefs } from "@/lib/prefs-store";
import { hexA, shade } from "@/lib/utils";

/**
 * Hydrates the persisted preference store on mount and applies theme
 * tokens to <html> as data-attributes + CSS custom properties.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = usePrefs((s) => s.theme);
  const font = usePrefs((s) => s.font);
  const accent = usePrefs((s) => s.accent);
  const readerSize = usePrefs((s) => s.readerSize);

  React.useEffect(() => {
    void usePrefs.persist.rehydrate();
  }, []);

  React.useEffect(() => {
    const html = document.documentElement;
    html.dataset.theme = theme;
    html.dataset.font = font;
    html.style.setProperty("--accent", accent);
    html.style.setProperty("--accent-2", shade(accent, -0.18));
    html.style.setProperty("--accent-tint", hexA(accent, 0.13));
    html.style.setProperty("--reader-fs", `${readerSize}px`);
  }, [theme, font, accent, readerSize]);

  return <>{children}</>;
}

"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Preferences } from "./types";

type PrefsStore = Preferences & {
  setTheme: (t: Preferences["theme"]) => void;
  setFont: (f: Preferences["font"]) => void;
  setAccent: (a: string) => void;
  setSessionMinutes: (m: number) => void;
  setReaderSize: (s: number) => void;
};

const DEFAULTS: Preferences = {
  theme: "paper",
  font: "serif",
  accent: "#b85c38",
  sessionMinutes: 12,
  readerSize: 19,
};

export const ACCENT_OPTIONS = [
  "#b85c38", // terracotta
  "#5a7a4a", // forest
  "#3a6a8a", // ocean
  "#b58a3a", // gold
  "#7a4a6a", // plum
];

export const usePrefs = create<PrefsStore>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setTheme: (theme) => set({ theme }),
      setFont: (font) => set({ font }),
      setAccent: (accent) => set({ accent }),
      setSessionMinutes: (sessionMinutes) => set({ sessionMinutes }),
      setReaderSize: (readerSize) => set({ readerSize }),
    }),
    {
      name: "dailypages-prefs",
      // Avoid hydration mismatches: skip server-side hydration.
      skipHydration: true,
    },
  ),
);

/**
 * Returns whether the real API is wired up. When `false`, components fall back
 * to the mock data in lib/mock-data.ts so the design stays explorable without
 * a backend.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
export const HAS_API = API_BASE.length > 0;
export const HAS_CLERK = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
export const HAS_BACKEND = HAS_API && HAS_CLERK;

"use client";

import { useAuth } from "@clerk/nextjs";
import { HAS_CLERK } from "@/lib/api-config";

/**
 * Returns a stable getToken function. When Clerk is configured, it pulls the
 * active session JWT; otherwise it returns null so the API client throws
 * meaningfully. Always calls useAuth() to keep rules-of-hooks happy — the
 * Clerk shim is harmless when no key is set; we just ignore its output.
 */
export function useGetToken(): () => Promise<string | null> {
  const auth = useAuth();
  if (!HAS_CLERK) return async () => null;
  return async () => (await auth.getToken()) ?? null;
}

"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { HAS_CLERK } from "@/lib/api-config";

/**
 * Wraps the app in ClerkProvider when a publishable key is configured, otherwise
 * renders children unchanged. This keeps the design demo working without auth
 * env vars while letting real auth turn on with a single flag.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (!HAS_CLERK) return <>{children}</>;
  return <ClerkProvider>{children}</ClerkProvider>;
}

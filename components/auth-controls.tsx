"use client";

import { SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/nextjs";
import { HAS_CLERK } from "@/lib/api-config";

/**
 * Auth controls for the topbar's right rail.
 *
 * Three branches:
 * 1. No Clerk configured  → render the static "A" monogram from the design demo.
 * 2. Clerk + signed in    → Clerk's <UserButton/> (avatar + sign-out menu).
 * 3. Clerk + signed out   → Sign in / Sign up text links.
 */
export function AuthControls() {
  if (!HAS_CLERK) return <DemoMonogram />;
  return <ClerkControls />;
}

function ClerkControls() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) {
    // Reserve the slot during hydration to avoid layout jump.
    return <span className="h-[30px] w-[30px]" aria-hidden />;
  }
  if (isSignedIn) {
    return (
      <UserButton
        appearance={{
          elements: {
            avatarBox: "h-[30px] w-[30px]",
          },
        }}
      />
    );
  }
  return (
    <div className="flex items-center gap-1">
      <SignInButton mode="modal">
        <button className="rounded-full px-3 py-2 text-[12.5px] text-ink-2 transition-colors hover:text-ink">
          Sign in
        </button>
      </SignInButton>
      <SignUpButton mode="modal">
        <button className="rounded-full bg-accent px-3 py-2 text-[12.5px] font-medium text-white transition-transform hover:-translate-y-px">
          Sign up
        </button>
      </SignUpButton>
    </div>
  );
}

function DemoMonogram() {
  return (
    <span
      aria-hidden
      className="grid h-[30px] w-[30px] place-items-center rounded-full bg-accent text-[12px] font-medium text-white font-serif"
    >
      A
    </span>
  );
}

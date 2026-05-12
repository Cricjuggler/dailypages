import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

const HAS_CLERK = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

const passthrough = (_req: NextRequest) => NextResponse.next();

export default HAS_CLERK ? clerkMiddleware() : passthrough;

export const config = {
  // Pattern from Clerk's official Next.js quickstart — skips _next, static
  // assets, and common file types; runs on everything else plus /api and /trpc.
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

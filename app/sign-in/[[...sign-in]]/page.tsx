import { SignIn } from "@clerk/nextjs";
import { HAS_CLERK } from "@/lib/api-config";

export default function SignInPage() {
  if (!HAS_CLERK) {
    return (
      <div className="container-narrow mx-auto max-w-[720px] px-7 pt-[60px] pb-20 max-md:px-4">
        <div className="eyebrow">Auth not configured</div>
        <h1 className="display mt-2 text-[36px]">Sign-in is offline</h1>
        <p className="mt-2 text-[15px] text-ink-2">
          Set <code className="font-mono text-[13px]">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> in
          your environment to enable Clerk-backed authentication.
        </p>
      </div>
    );
  }
  return (
    <div className="grid place-items-center px-4 pt-16 pb-20">
      <SignIn />
    </div>
  );
}

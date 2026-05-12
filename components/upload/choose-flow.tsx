"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Spark } from "@/components/icons";
import { api, ApiError } from "@/lib/api";
import { HAS_BACKEND } from "@/lib/api-config";
import { useGetToken } from "@/lib/use-token";
import { cn } from "@/lib/utils";

export function ChooseFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const bookId = params.get("bookId");
  const getToken = useGetToken();
  const [submitting, setSubmitting] = React.useState<"asis" | "ai" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const onReadAsIs = async () => {
    if (!HAS_BACKEND || !bookId) {
      // Demo mode — jump straight to the mock plan view.
      router.push("/plan");
      return;
    }
    setSubmitting("asis");
    setError(null);
    try {
      const plan = await api.planAsIs(bookId, { minutes_per_session: 12, pace: "steady" }, getToken);
      router.push(`/plan/${plan.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? `${e.status}: ${e.message}` : (e as Error).message);
      setSubmitting(null);
    }
  };

  const onAiPlan = () => {
    setSubmitting("ai");
    if (HAS_BACKEND && bookId) {
      router.push(`/personalize?bookId=${bookId}`);
    } else {
      router.push("/personalize");
    }
  };

  return (
    <div className="container-narrow mx-auto w-full max-w-[720px] animate-fade-up px-7 pt-[60px] pb-20 max-md:px-4">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] text-ink-2 transition-colors hover:text-ink"
      >
        <ArrowLeft /> Back
      </Link>

      <div className="eyebrow mb-2.5">Step 2 of 3</div>
      <h1 className="display mb-2.5 text-[36px]">How would you like to read?</h1>
      <p className="mb-10 max-w-[520px] text-[15px] text-ink-2">
        Both paths land in the same reader — paper-feel, distraction-free, paced. The difference
        is in how the text gets there.
      </p>

      <div className="flex flex-col gap-4">
        <OptionCard
          eyebrow="As-is · Free · Instant"
          title="Read the original text"
          body="The author's exact words, split into sessions by chapter. Best for books you want preserved verbatim — and the cheapest path: no AI calls, ready in seconds."
          submitting={submitting === "asis"}
          disabled={submitting !== null}
          onClick={onReadAsIs}
          cta="Read as-is"
        />

        <OptionCard
          eyebrow="AI-paced · Costs tokens · ~10 min"
          title="Personalize and rewrite"
          body="Pick session length and depth. We rewrite the book into your chosen number of sittings, keeping the author's voice but adjusting density. Best for long or dense books you want shaped to your time."
          submitting={submitting === "ai"}
          disabled={submitting !== null}
          onClick={onAiPlan}
          cta="Shape with AI"
          icon
        />
      </div>

      {error && (
        <div className="mt-5 rounded-md border border-line-2 bg-bg-elev px-4 py-3 text-[13px] text-accent-2">
          {error}
        </div>
      )}

      <p className="mt-8 text-center font-serif text-[12px] italic text-ink-3">
        You can switch paths later — both create separate plans on the same book.
      </p>
    </div>
  );
}

function OptionCard({
  eyebrow,
  title,
  body,
  submitting,
  disabled,
  onClick,
  cta,
  icon,
}: {
  eyebrow: string;
  title: string;
  body: string;
  submitting: boolean;
  disabled: boolean;
  onClick: () => void;
  cta: string;
  icon?: boolean;
}) {
  return (
    <Card
      className={cn(
        "px-7 py-6 transition-all duration-200",
        disabled && !submitting && "opacity-50",
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        {icon && (
          <span className="text-accent">
            <Spark size={14} />
          </span>
        )}
        <div className="eyebrow">{eyebrow}</div>
      </div>
      <h2 className="display mb-2 text-[22px]">{title}</h2>
      <p className="mb-5 text-[14px] leading-[1.55] text-ink-2">{body}</p>
      <Button variant={icon ? "accent" : "ghost"} onClick={onClick} disabled={disabled}>
        {submitting ? "Working…" : cta} <ArrowRight />
      </Button>
    </Card>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { ArrowLeft, ArrowRight, Check } from "@/components/icons";
import { api, ApiError } from "@/lib/api";
import { HAS_BACKEND } from "@/lib/api-config";
import { useGetToken } from "@/lib/use-token";
import { cn } from "@/lib/utils";
import { TODAY } from "@/lib/mock-data";

type Pace = "sprint" | "steady" | "gentle";
type Depth = "quick" | "balanced" | "deep";

const PACE_MUL: Record<Pace, number> = { sprint: 1, steady: 7 / 5, gentle: 7 / 3 };

const MINUTE_PRESETS = [5, 10, 15, 20, 30, 45];
const SESSION_PRESETS = [7, 12, 21, 30, 50];

export function PersonalizeFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookId = searchParams.get("bookId");
  const getToken = useGetToken();
  const [minutes, setMinutes] = React.useState(15);
  const [sessions, setSessions] = React.useState(12);
  const [pace, setPace] = React.useState<Pace>("steady");
  const [depth, setDepth] = React.useState<Depth>("balanced");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const days = Math.max(sessions, Math.round(sessions * PACE_MUL[pace]));
  const finishDate = new Date(TODAY);
  finishDate.setDate(finishDate.getDate() + days);
  const finishStr = finishDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="container-narrow mx-auto w-full max-w-[720px] animate-fade-up px-7 pt-[60px] pb-20 max-md:px-4">
      <Link
        href="/upload"
        className="mb-6 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] text-ink-2 transition-colors hover:text-ink"
      >
        <ArrowLeft /> Back
      </Link>

      <div className="eyebrow mb-2.5">Step 2 of 3</div>
      <h1 className="display mb-2.5 text-[36px]">Shape your reading</h1>
      <p className="mb-9 max-w-[520px] text-[15px] text-ink-2">
        Tell us how you want to read. We&rsquo;ll fit the book into the shape you choose &mdash;
        keeping the author&rsquo;s voice, adjusting density.
      </p>

      <Section title="Time per session" hint="How long can you read in one sitting?">
        <NumberDial
          value={minutes}
          onChange={setMinutes}
          min={5}
          max={60}
          unit="min"
          presets={MINUTE_PRESETS}
          phrase={
            minutes <= 7
              ? "A coffee break."
              : minutes <= 14
                ? "A short commute."
                : minutes <= 25
                  ? "A focused sit."
                  : minutes <= 40
                    ? "A long evening."
                    : "An immersive session."
          }
        />
      </Section>

      <Section
        title="Number of sessions"
        hint="How many sittings should the book take?"
      >
        <NumberDial
          value={sessions}
          onChange={setSessions}
          min={5}
          max={80}
          unit="sessions"
          presets={SESSION_PRESETS}
          phrase={
            sessions <= 7
              ? "A week of reading."
              : sessions <= 14
                ? "A two-week journey."
                : sessions <= 24
                  ? "A month, give or take."
                  : sessions <= 40
                    ? "A slow companion."
                    : "Take it leisurely."
          }
        />
      </Section>

      <Section title="Pace" hint="How often do you want to read?">
        <Segmented<Pace>
          value={pace}
          onChange={setPace}
          options={[
            { v: "sprint", label: "Sprint", sub: "Daily" },
            { v: "steady", label: "Steady", sub: "5 days / week" },
            { v: "gentle", label: "Gentle", sub: "3 days / week" },
          ]}
        />
      </Section>

      <Section
        title="Depth of understanding"
        hint="Density of each session, not the count."
      >
        <DepthChooser value={depth} onChange={setDepth} />
      </Section>

      <Card className="mt-8 px-6 py-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow mb-2">Your plan</div>
            <div className="display text-[22px] leading-[1.3]" style={{ textWrap: "balance" }}>
              <span className="tnum">{sessions}</span> sessions of{" "}
              <span className="tnum">{minutes}</span> min &middot; finish by{" "}
              <span className="text-accent">{finishStr}</span>
            </div>
            <div className="mt-1 text-[12.5px] text-ink-3">
              {sessions * minutes} min of reading total &middot;{" "}
              {depth === "quick"
                ? "tight, distilled prose"
                : depth === "balanced"
                  ? "author's voice preserved"
                  : "fuller treatment, more nuance"}
            </div>
          </div>
          <Button
            variant="accent"
            disabled={submitting}
            onClick={async () => {
              if (!HAS_BACKEND || !bookId) {
                router.push("/plan");
                return;
              }
              setSubmitting(true);
              setError(null);
              try {
                const plan = await api.createPlan(
                  {
                    book_id: bookId,
                    minutes_per_session: minutes,
                    target_sessions: sessions,
                    depth,
                    pace,
                  },
                  getToken,
                );
                await api.generatePlan(plan.id, getToken);
                router.push(`/plan/${plan.id}`);
              } catch (e) {
                setError(
                  e instanceof ApiError ? `${e.status}: ${e.message}` : (e as Error).message,
                );
                setSubmitting(false);
              }
            }}
          >
            {submitting ? "Generating…" : "Generate plan"} <ArrowRight />
          </Button>
        </div>
        {error && <div className="mt-3 text-[12px] text-accent-2">{error}</div>}
      </Card>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-9">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="font-serif text-[17px]">{title}</div>
        <div className="text-[12px] text-ink-2">{hint}</div>
      </div>
      {children}
    </div>
  );
}

function NumberDial({
  value,
  onChange,
  min,
  max,
  unit,
  presets,
  phrase,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  unit: string;
  presets: number[];
  phrase: string;
}) {
  return (
    <Card className="p-5">
      <div className="mb-3.5 flex items-baseline justify-between gap-3">
        <div className="display font-serif leading-none" style={{ fontSize: 56 }}>
          <span className="tnum">{value}</span>
          <span className="ml-1.5 font-sans text-[18px] font-normal text-ink-2">{unit}</span>
        </div>
        <div className="max-w-[220px] text-right text-[12.5px] text-ink-2">{phrase}</div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: "var(--accent)" }}
      />
      <div className="mt-3.5 flex flex-wrap gap-2">
        {presets.map((p) => {
          const active = value === p;
          return (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11.5px] transition-colors",
                active
                  ? "bg-accent text-white border border-transparent"
                  : "bg-bg-elev border border-line text-ink-2 hover:text-ink",
              )}
            >
              {p} {unit === "min" ? "min" : ""}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { v: T; label: string; sub: string }[];
}) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      {options.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className={cn(
              "rounded-xl px-3.5 py-4 text-left transition-all duration-200",
              active
                ? "border border-accent bg-accent-tint text-accent-2"
                : "border border-line bg-bg-elev text-ink hover:border-line-2",
            )}
          >
            <div className="mb-0.5 font-serif text-[15px]">{o.label}</div>
            <div
              className={cn("text-[11.5px]", active ? "text-accent-2 opacity-85" : "text-ink-3")}
            >
              {o.sub}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DepthChooser({
  value,
  onChange,
}: {
  value: Depth;
  onChange: (v: Depth) => void;
}) {
  const opts: {
    v: Depth;
    label: string;
    body: string;
    recommended?: boolean;
  }[] = [
    {
      v: "quick",
      label: "Quick",
      body: "Tight prose. The shape of the argument and the essential examples.",
    },
    {
      v: "balanced",
      label: "Balanced",
      body: "Author's voice preserved. Explanatory bridges where needed.",
      recommended: true,
    },
    {
      v: "deep",
      label: "Deep",
      body: "Full nuance. Side-quests into related ideas. Richer per session.",
    },
  ];
  return (
    <div className="flex flex-col gap-2">
      {opts.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className={cn(
              "rounded-lg px-[18px] py-3.5 text-left transition-all duration-200 shadow-paper",
              active
                ? "border border-accent bg-accent-tint"
                : "border border-line bg-bg-elev hover:border-line-2",
            )}
          >
            <div className="mb-1 flex items-center justify-between gap-3">
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-[16px]">{o.label}</span>
                {o.recommended && (
                  <Chip style={{ fontSize: 10, padding: "2px 8px" }}>Recommended</Chip>
                )}
              </div>
              <div
                className="grid h-4 w-4 place-items-center rounded-full text-white"
                style={{
                  border: `1px solid ${active ? "var(--accent)" : "var(--line-2)"}`,
                  background: active ? "var(--accent)" : "transparent",
                }}
              >
                {active && <Check size={10} />}
              </div>
            </div>
            <div className="text-[13px] leading-[1.5] text-ink-2">{o.body}</div>
          </button>
        );
      })}
    </div>
  );
}

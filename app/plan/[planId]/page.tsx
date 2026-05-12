import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Plus } from "@/components/icons";
import { PlanRow } from "@/components/plan/plan-row";
import { HAS_BACKEND } from "@/lib/api-config";
import { serverApi } from "@/lib/api-server";

type Params = Promise<{ planId: string }>;

export const dynamic = "force-dynamic";

export default async function DynamicPlanPage({ params }: { params: Params }) {
  if (!HAS_BACKEND) notFound();
  const { planId } = await params;
  const plan = await serverApi.getPlan(planId).catch(() => null);
  if (!plan) notFound();
  const book = await serverApi.getBook(plan.book_id).catch(() => null);
  if (!book) notFound();

  // Pair each row's display state with the real session UUID so rows link to the reader.
  const sessions = plan.sessions.map((s, i) => ({
    id: s.id,
    row: {
      num: s.session_number,
      title: s.title,
      chapter: s.chapter ?? "",
      state: (i === 0 ? "today" : "next") as "done" | "today" | "next",
    },
    estimatedMinutes: s.estimated_minutes,
  }));

  const firstSessionId = plan.sessions[0]?.id;
  const totalMinutes = sessions.reduce((acc, s) => acc + s.estimatedMinutes, 0);
  // Vary-or-uniform: if every session has the same minute count it's an AI-paced
  // plan; otherwise it's the as-is path where chapter lengths drive the minutes.
  const sessionMinutes = sessions.map((s) => s.estimatedMinutes);
  const uniform =
    sessionMinutes.length > 0 && sessionMinutes.every((m) => m === sessionMinutes[0]);
  const lengthBlurb = uniform
    ? `${sessionMinutes[0]} min each`
    : `varies — ${Math.round(totalMinutes / sessions.length)} min avg`;

  // Finish-by date derived from plan.total_days from the day the plan was made.
  const finish = new Date(plan.created_at);
  finish.setDate(finish.getDate() + plan.total_days);
  const finishStr = finish.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="container-narrow mx-auto w-full max-w-[720px] animate-fade-up px-7 pt-[60px] pb-20 max-md:px-4">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] text-ink-2 transition-colors hover:text-ink"
      >
        <ArrowLeft /> Back to library
      </Link>

      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-2.5">Reading plan</div>
          <h1 className="display mb-2 text-[36px]">{book.title}</h1>
          <p className="text-[14px] text-ink-2">
            {plan.total_sessions} sessions &middot; {lengthBlurb} &middot;{" "}
            <span className="tnum">{totalMinutes}</span> min total &middot; finish by{" "}
            <b className="text-ink">{finishStr}</b>
          </p>
          {book.author && (
            <p className="mt-1 font-serif text-[13px] italic text-ink-3">
              {book.author}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link href={`/personalize?bookId=${book.id}`}>
            <Button variant="ghost">
              <Plus /> New plan
            </Button>
          </Link>
          {firstSessionId && (
            <Link href={`/reader/${firstSessionId}`}>
              <Button variant="accent">
                Start reading <ArrowRight />
              </Button>
            </Link>
          )}
        </div>
      </div>

      <Card className="py-2">
        {sessions.length === 0 && (
          <p className="px-6 py-8 text-center text-[14px] text-ink-2">
            Sessions are still generating. Refresh in a moment.
          </p>
        )}
        {sessions.map((s, i) => (
          <PlanRow
            key={s.id}
            session={s.row}
            sessionId={s.id}
            last={i === sessions.length - 1}
            minutesPerSession={s.estimatedMinutes}
          />
        ))}
      </Card>

      <p className="mt-4 text-center font-serif text-[12px] italic text-ink-3">
        Click any session to read it. You can revisit completed sessions or jump ahead.
      </p>
    </div>
  );
}

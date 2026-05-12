import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ArrowRight } from "@/components/icons";
import { PlanRow } from "@/components/plan/plan-row";
import { APP_DATA } from "@/lib/mock-data";

export default function PlanPage() {
  const { plan, activeBook } = APP_DATA;

  return (
    <div className="container-narrow mx-auto w-full max-w-[720px] animate-fade-up px-7 pt-[60px] pb-20 max-md:px-4">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] text-ink-2 transition-colors hover:text-ink"
      >
        <ArrowLeft /> Back
      </Link>

      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-2.5">Reading plan</div>
          <h1 className="display mb-2 text-[36px]">{activeBook.title}</h1>
          <p className="text-[14px] text-ink-2">
            {activeBook.plan.sessionsTotal} sessions ·{" "}
            {activeBook.plan.minutesPerSession} min each · finish by{" "}
            <b className="text-ink">{activeBook.plan.finishBy}</b>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost">Adjust</Button>
          <Link href="/reader">
            <Button variant="accent">
              Read today&rsquo;s <ArrowRight />
            </Button>
          </Link>
        </div>
      </div>

      <Card className="py-2">
        {plan.map((s, i) => (
          <PlanRow
            key={s.num}
            session={s}
            last={i === plan.length - 1}
            minutesPerSession={activeBook.plan.minutesPerSession}
          />
        ))}
      </Card>

      <p className="mt-4 text-center font-serif text-[12px] italic text-ink-2">
        Sessions adapt as you read — slower days don&rsquo;t break the plan.
      </p>
    </div>
  );
}

import { notFound } from "next/navigation";
import { RecapView } from "@/components/recap/recap-view";
import { HAS_BACKEND } from "@/lib/api-config";
import { serverApi } from "@/lib/api-server";
import { APP_DATA } from "@/lib/mock-data";
import type { QuizItem, Recap } from "@/lib/types";

type Params = Promise<{ sessionId: string }>;

export const dynamic = "force-dynamic";

export default async function DynamicRecapPage({ params }: { params: Params }) {
  if (!HAS_BACKEND) notFound();
  const { sessionId } = await params;
  const session = await serverApi.getSession(sessionId).catch(() => null);
  if (!session) notFound();
  const plan = await serverApi.getPlan(session.reading_plan_id).catch(() => null);
  if (!plan) notFound();
  const book = await serverApi.getBook(plan.book_id).catch(() => null);
  if (!book) notFound();

  const recapData = (session.recap ?? {}) as { takeaways?: string[]; next_preview?: string };
  const recap: Recap = {
    takeaways: recapData.takeaways ?? [],
    quiz: ((session.quiz as QuizItem[] | null) ?? []),
    nextSession: {
      number: session.session_number + 1,
      title: recapData.next_preview ?? "Next session",
      readingTime: session.estimated_minutes,
    },
  };

  const activeBook = {
    id: book.id,
    title: book.title,
    author: book.author ?? "Unknown",
    year: "",
    cover: book.cover_params ?? { hue: 24, sat: 22, dark: 20, light: 86 },
    pages: book.pages ?? 0,
    plan: {
      sessionsTotal: plan.total_sessions,
      sessionsDone: session.session_number,
      minutesPerSession: plan.minutes_per_session,
      depth: plan.depth,
      finishBy: "",
    },
    progress: session.session_number / plan.total_sessions,
    todaySession: {
      number: session.session_number,
      title: session.title,
      readingTime: session.estimated_minutes,
      chapter: session.chapter ?? "",
      keyConcepts: [],
    },
  };

  // Stats are still mock — no aggregation endpoint yet.
  return <RecapView recap={recap} book={activeBook} stats={APP_DATA.stats} />;
}

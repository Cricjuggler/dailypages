import { notFound, redirect } from "next/navigation";
import { ReaderView } from "@/components/reader/reader-view";
import { HAS_BACKEND } from "@/lib/api-config";
import { serverApi } from "@/lib/api-server";
import type { ProseBlock } from "@/lib/types";

type Params = Promise<{ sessionId: string }>;

export const dynamic = "force-dynamic";

async function tryFetch<T>(fn: () => Promise<T>): Promise<{ data: T | null; error: string | null }> {
  try {
    return { data: await fn(), error: null };
  } catch (e) {
    return { data: null, error: (e as Error).message };
  }
}

export default async function DynamicReaderPage({ params }: { params: Params }) {
  if (!HAS_BACKEND) notFound();
  const { sessionId } = await params;

  const sessionRes = await tryFetch(() => serverApi.getSession(sessionId));
  // Bounce signed-out users to sign-in rather than showing a 404.
  if (sessionRes.error?.startsWith("401")) redirect(`/sign-in?redirect_url=/reader/${sessionId}`);
  if (!sessionRes.data) notFound();
  const session = sessionRes.data;

  const planRes = await tryFetch(() => serverApi.getPlan(session.reading_plan_id));
  if (!planRes.data) notFound();
  const plan = planRes.data;

  const bookRes = await tryFetch(() => serverApi.getBook(plan.book_id));
  if (!bookRes.data) notFound();
  const book = bookRes.data;

  // Build the ActiveBook shape the ReaderView expects from API rows.
  const activeBook = {
    id: book.id,
    title: book.title,
    author: book.author ?? "Unknown",
    year: "",
    cover: book.cover_params ?? { hue: 24, sat: 22, dark: 20, light: 86 },
    pages: book.pages ?? 0,
    plan: {
      sessionsTotal: plan.total_sessions,
      sessionsDone: 0, // server-side progress aggregation lands later
      minutesPerSession: plan.minutes_per_session,
      depth: plan.depth,
      finishBy: "",
    },
    progress: 0,
    todaySession: {
      number: session.session_number,
      title: session.title,
      readingTime: session.estimated_minutes,
      chapter: session.chapter ?? "",
      keyConcepts: [],
    },
  };

  const content = (session.content_blocks ?? []) as ProseBlock[];

  return <ReaderView book={activeBook} content={content} sessionId={session.id} />;
}

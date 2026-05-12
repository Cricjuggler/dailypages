import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { HeroCard } from "@/components/library/hero-card";
import { ShelfBook } from "@/components/library/shelf-book";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus } from "@/components/icons";
import { HAS_BACKEND } from "@/lib/api-config";
import { serverApi } from "@/lib/api-server";
import type { BookApi } from "@/lib/api-types";
import { APP_DATA } from "@/lib/mock-data";
import { formatGreetingDate, sessionPhrase, timeOfDayGreeting } from "@/lib/utils";
import type { LibraryBook } from "@/lib/types";

export const dynamic = "force-dynamic";

const COVER_PALETTES = [
  { hue: 28, sat: 22, dark: 18, light: 88 },
  { hue: 12, sat: 30, dark: 24, light: 86 },
  { hue: 210, sat: 18, dark: 20, light: 86 },
  { hue: 130, sat: 20, dark: 22, light: 84 },
  { hue: 48, sat: 28, dark: 20, light: 86 },
  { hue: 0, sat: 35, dark: 22, light: 84 },
];

function apiBookToLibraryBook(b: BookApi, idx: number): LibraryBook {
  const cover = b.cover_params ?? COVER_PALETTES[idx % COVER_PALETTES.length];
  const status: LibraryBook["status"] =
    b.status === "ready"
      ? "Up next"
      : b.status === "parsing"
        ? "Reading"
        : b.status === "failed"
          ? "Paused"
          : "Up next";
  return {
    id: b.id,
    title: b.title,
    author: b.author ?? "Unknown",
    cover,
    progress: 0,
    status,
    lastRead: "—",
  };
}

export default async function LibraryPage() {
  const today = new Date();
  const greeting = timeOfDayGreeting(today);
  const dateLine = formatGreetingDate(today);

  if (!HAS_BACKEND) {
    return <MockLibrary greeting={greeting} dateLine={dateLine} />;
  }

  const authState = await auth();
  if (!authState.userId) {
    // Not signed in — show the marketing/demo experience.
    return <MockLibrary greeting={greeting} dateLine={dateLine} />;
  }

  const user = await currentUser();
  const firstName = user?.firstName || user?.username || "there";

  const books = await serverApi.listBooks().catch(() => [] as BookApi[]);

  // For each book, find its most recent plan so we can route directly.
  const booksWithPlan = await Promise.all(
    books.map(async (b) => {
      try {
        const plans = await serverApi.listPlansForBook(b.id);
        return { book: b, planId: plans[0]?.id ?? null };
      } catch {
        return { book: b, planId: null };
      }
    }),
  );

  // Pick the most recent book that has a plan as the "continue reading" target.
  const active = booksWithPlan.find((x) => x.planId) ?? null;
  let activeSession: { id: string; title: string; chapter: string | null; minutes: number } | null = null;
  let activeFinishBy: string | null = null;
  let activePlanSessions = 0;
  if (active?.planId) {
    try {
      const plan = await serverApi.getPlan(active.planId);
      activePlanSessions = plan.total_sessions;
      const first = plan.sessions[0];
      if (first) {
        activeSession = {
          id: first.id,
          title: first.title,
          chapter: first.chapter,
          minutes: first.estimated_minutes,
        };
      }
      const finish = new Date(plan.created_at);
      finish.setDate(finish.getDate() + plan.total_days);
      activeFinishBy = finish.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      // ignore — hero falls back to "plans pending"
    }
  }

  return (
    <div className="container mx-auto w-full max-w-[1180px] animate-fade-up px-7 pt-10 pb-20 max-md:px-4">
      <div className="mb-9">
        <div className="eyebrow">{dateLine}</div>
        <h1 className="display mt-2 text-[40px] max-md:text-[34px]">
          {greeting}, {firstName}.
        </h1>
        <p className="mt-1.5 font-serif text-[16px] italic text-ink-2">
          {activeSession ? sessionPhrase(activeSession.minutes) : "A quiet place to read."}
        </p>
      </div>

      {active && activeSession ? (
        <RealHero
          book={active.book}
          planId={active.planId!}
          session={activeSession}
          totalSessions={activePlanSessions}
          finishBy={activeFinishBy}
        />
      ) : booksWithPlan.length > 0 ? (
        <Card className="mb-12 p-8">
          <div className="eyebrow mb-2">Plans pending</div>
          <p className="text-[15px] text-ink-2">
            Your books are uploaded. Pick one below to personalize and generate its reading
            plan.
          </p>
        </Card>
      ) : (
        <Card className="mb-12 p-8 text-center">
          <div className="eyebrow mb-2">Empty shelf</div>
          <h2 className="display mb-3 text-[24px]">Add your first book.</h2>
          <p className="mb-5 text-[15px] text-ink-2">PDF or EPUB, up to 200 MB.</p>
          <Link href="/upload">
            <Button variant="accent">
              <Plus /> Upload a book
            </Button>
          </Link>
        </Card>
      )}

      <div className="mb-5 flex items-center justify-between">
        <h2 className="display text-[22px]">Your library</h2>
        <Link href="/upload">
          <Button variant="ghost">
            <Plus /> Upload a book
          </Button>
        </Link>
      </div>

      {booksWithPlan.length === 0 ? (
        <p className="text-[14px] text-ink-3">No books yet. Upload one above to get started.</p>
      ) : (
        <div
          className="grid gap-7"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
        >
          {booksWithPlan.map(({ book, planId }, i) => {
            const libBook = apiBookToLibraryBook(book, i);
            const href = planId
              ? `/plan/${planId}`
              : `/personalize?bookId=${book.id}`;
            return (
              <Link key={book.id} href={href} className="block">
                <ShelfBook book={libBook} delay={i * 40} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RealHero({
  book,
  planId,
  session,
  totalSessions,
  finishBy,
}: {
  book: BookApi;
  planId: string;
  session: { id: string; title: string; chapter: string | null; minutes: number };
  totalSessions: number;
  finishBy: string | null;
}) {
  const cover = book.cover_params ?? COVER_PALETTES[0];
  return (
    <Card className="mb-12 p-8">
      <div className="eyebrow mb-3">Continue reading</div>
      <div className="mb-5 flex items-start gap-4">
        <div
          className="h-[92px] w-[64px] shrink-0 rounded-sm"
          style={{
            background: `linear-gradient(135deg, hsl(${cover.hue} ${cover.sat}% ${cover.dark}%), hsl(${cover.hue} ${Math.max(8, cover.sat - 10)}% ${Math.max(10, cover.dark - 6)}%))`,
            boxShadow:
              "inset 6px 0 12px -6px rgba(0,0,0,.5), 2px 4px 14px -4px rgba(40,28,12,.45)",
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="eyebrow mb-1">
            {book.title}
            {session.chapter ? ` · ${session.chapter}` : ""}
          </div>
          <h2 className="display mb-2 text-[28px]">{session.title}</h2>
          <p className="text-[13.5px] leading-[1.55] text-ink-2">
            {book.author ?? "Unknown"} · {session.minutes} min · {totalSessions} sessions in this plan
            {finishBy ? ` · finish by ${finishBy}` : ""}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/reader/${session.id}`}>
          <Button variant="accent">Begin reading</Button>
        </Link>
        <Link
          href={`/plan/${planId}`}
          className="rounded-full px-3 py-2 text-[12.5px] text-ink-2 transition-colors hover:text-ink"
        >
          See plan
        </Link>
      </div>
    </Card>
  );
}

function MockLibrary({ greeting, dateLine }: { greeting: string; dateLine: string }) {
  const data = APP_DATA;
  return (
    <div className="container mx-auto w-full max-w-[1180px] animate-fade-up px-7 pt-10 pb-20 max-md:px-4">
      <div className="mb-9">
        <div className="eyebrow">{dateLine}</div>
        <h1 className="display mt-2 text-[40px] max-md:text-[34px]">{greeting}, Alex.</h1>
        <p className="mt-1.5 font-serif text-[16px] italic text-ink-2">
          {sessionPhrase(data.activeBook.plan.minutesPerSession)}
        </p>
      </div>

      <HeroCard book={data.activeBook} days={data.days} stats={data.stats} />

      <div className="mb-5 flex items-center justify-between">
        <h2 className="display text-[22px]">Your library</h2>
        <Link href="/upload">
          <Button variant="ghost">
            <Plus /> Upload a book
          </Button>
        </Link>
      </div>

      <div
        className="grid gap-7"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
      >
        {data.library.map((b, i) => (
          <ShelfBook key={b.id} book={b} delay={i * 40} />
        ))}
      </div>
    </div>
  );
}

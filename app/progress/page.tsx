import { Card } from "@/components/ui/card";
import { Bar } from "@/components/ui/bar";
import { BookCover } from "@/components/book-cover";
import { Heatmap } from "@/components/progress/heatmap";
import { WeeklyBars } from "@/components/progress/weekly-bars";
import { APP_DATA } from "@/lib/mock-data";

export default function ProgressPage() {
  const { stats, days, library } = APP_DATA;
  const reading = library.filter((b) => b.status === "Reading" || b.status === "Paused").length;
  const inProgress = library.filter((b) => b.progress > 0 && b.progress < 1);

  return (
    <div className="container mx-auto w-full max-w-[1180px] animate-fade-up px-7 pt-10 pb-20 max-md:px-4">
      <div className="mb-9">
        <div className="eyebrow">Progress</div>
        <h1 className="display mt-2 text-[40px] max-md:text-[34px]">The slow accrual.</h1>
        <p className="mt-1.5 font-serif text-[15px] italic text-ink-2">
          Pages, like days, are a kind of compounding.
        </p>
      </div>

      {/* Stat row */}
      <div
        className="stat-grid mb-9 grid overflow-hidden rounded-lg border border-line bg-line"
        style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: 1 }}
      >
        <BigStat label="Current streak" value={stats.streak} unit="days" hint={`Best: ${stats.bestStreak}`} />
        <BigStat
          label="Books finished"
          value={stats.booksFinished}
          unit="this year"
          hint={`${reading} more in progress`}
        />
        <BigStat
          label="This week"
          value={stats.minutesThisWeek}
          unit="min"
          hint={`Goal: ${stats.minutesGoalWeek} min`}
        />
        <BigStat label="Avg session" value={stats.avgSession} unit="min" hint="Last 14 days" />
      </div>

      <div className="prog-grid grid gap-7" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
        <Card className="p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow mb-1">Last 70 days</div>
              <div className="font-serif text-[18px]">Reading consistency</div>
            </div>
            <div className="flex gap-3 text-[11px] text-ink-3">
              <Legend color="var(--line)" label="Off" />
              <Legend color="var(--accent-tint)" label="Light" />
              <Legend color="var(--accent)" label="Read" />
            </div>
          </div>
          <Heatmap days={days} />
        </Card>

        <Card className="p-6">
          <div className="eyebrow mb-1">This week</div>
          <div className="mb-5 font-serif text-[18px]">
            {stats.minutesThisWeek} of {stats.minutesGoalWeek} min
          </div>
          <WeeklyBars weekly={stats.weekly} />
        </Card>
      </div>

      <div className="mt-9">
        <h2 className="display mb-4 text-[22px]">In progress</h2>
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}
        >
          {inProgress.map((b) => (
            <Card key={b.id} className="flex gap-4 p-[18px]">
              <BookCover book={b} w={56} h={80} fontScale={0.8} />
              <div className="min-w-0 flex-1">
                <div
                  className="mb-0.5 font-serif text-[15px]"
                  style={{ textWrap: "balance" }}
                >
                  {b.title}
                </div>
                <div className="mb-3 text-[12px] text-ink-2">{b.author}</div>
                <Bar value={b.progress} />
                <div className="mt-2 flex items-center justify-between text-[11.5px] text-ink-3">
                  <span>{Math.round(b.progress * 100)}% complete</span>
                  <span>{b.lastRead}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .prog-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function BigStat({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: number;
  unit: string;
  hint: string;
}) {
  return (
    <div className="bg-bg-elev px-6 py-[22px]">
      <div className="eyebrow mb-3">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="display tnum text-[38px]">{value}</span>
        <span className="text-[13px] text-ink-2">{unit}</span>
      </div>
      <div className="mt-1.5 text-[12px] text-ink-2">{hint}</div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

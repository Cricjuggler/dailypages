export type CoverParams = {
  hue: number;
  sat: number;
  dark: number;
  light: number;
};

export type BookCoverInfo = {
  title: string;
  author: string;
  cover: CoverParams;
};

export type LibraryBook = BookCoverInfo & {
  id: string;
  progress: number;
  status: "Reading" | "Finished" | "Paused" | "Up next";
  lastRead: string;
};

export type ActiveBook = BookCoverInfo & {
  id: string;
  year: string;
  pages: number;
  plan: {
    sessionsTotal: number;
    sessionsDone: number;
    minutesPerSession: number;
    depth: string;
    finishBy: string;
  };
  progress: number;
  todaySession: {
    number: number;
    title: string;
    readingTime: number;
    chapter: string;
    keyConcepts: string[];
  };
};

export type ProseBlock =
  | { kind: "intro"; eyebrow: string; title: string; meta: string }
  | { kind: "p"; text: string; dropcap?: boolean }
  | { kind: "pullquote"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "section-mark"; text: string }
  | { kind: "outro" };

export type QuizItem = {
  q: string;
  choices: string[];
  correct: number;
};

export type Recap = {
  takeaways: string[];
  quiz: QuizItem[];
  nextSession: { number: number; title: string; readingTime: number };
};

export type StreakDay = {
  date: Date;
  state: "miss" | "light" | "read" | "today";
};

export type WeeklyStat = { day: string; min: number };

export type Stats = {
  streak: number;
  bestStreak: number;
  booksFinished: number;
  minutesThisWeek: number;
  minutesGoalWeek: number;
  avgSession: number;
  weekly: WeeklyStat[];
};

export type PlanRow = {
  num: number;
  title: string;
  chapter: string;
  state: "done" | "today" | "next";
  recap?: boolean;
};

export type AppData = {
  activeBook: ActiveBook;
  todayContent: ProseBlock[];
  recap: Recap;
  library: LibraryBook[];
  days: StreakDay[];
  stats: Stats;
  plan: PlanRow[];
  today: Date;
};

export type Theme = "paper" | "sepia" | "dark";
export type ReaderFont = "serif" | "sans" | "mono";

export type Preferences = {
  theme: Theme;
  font: ReaderFont;
  accent: string;
  sessionMinutes: number;
  readerSize: number;
};

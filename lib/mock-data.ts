import type { AppData } from "./types";

export const TODAY = new Date(2026, 4, 8); // May 8, 2026

const activeBook: AppData["activeBook"] = {
  id: "meditations",
  title: "Meditations",
  author: "Marcus Aurelius",
  year: "c. 175 CE",
  cover: { hue: 28, sat: 22, dark: 18, light: 88 },
  pages: 254,
  plan: {
    sessionsTotal: 24,
    sessionsDone: 7,
    minutesPerSession: 12,
    depth: "Balanced",
    finishBy: "Jun 6",
  },
  progress: 0.29,
  todaySession: {
    number: 8,
    title: "On returning to oneself",
    readingTime: 12,
    chapter: "Book IV",
    keyConcepts: ["Inner retreat", "The fleeting present", "Acceptance of nature"],
  },
};

const todayContent: AppData["todayContent"] = [
  {
    kind: "intro",
    eyebrow: "Today · Session 8 of 24",
    title: "On returning to oneself",
    meta: "Marcus Aurelius · Book IV · ~12 min",
  },
  {
    kind: "p",
    dropcap: true,
    text: "Men seek retreats for themselves, houses in the country, sea-shores, and mountains; and thou too art wont to desire such things very much. But this is altogether a mark of the most common sort of men, for it is in thy power whenever thou shalt choose to retire into thyself. For nowhere either with more quiet or more freedom from trouble does a man retire than into his own soul, particularly when he has within him such thoughts that by looking into them he is immediately in perfect tranquillity.",
  },
  {
    kind: "p",
    text: "Constantly then give to thyself this retreat, and renew thyself; and let thy principles be brief and fundamental, which, as soon as thou shalt recur to them, will be sufficient to cleanse the soul completely, and to send thee back free from all discontent with the things to which thou returnest.",
  },
  {
    kind: "pullquote",
    text: "It is in thy power whenever thou shalt choose to retire into thyself.",
  },
  {
    kind: "p",
    text: "For with what art thou discontented? With the badness of men? Recall to thy mind this conclusion, that rational animals exist for one another, and that to endure is a part of justice, and that men do wrong involuntarily; and consider how many already, after mutual enmity, suspicion, hatred, and fighting, have been stretched dead, reduced to ashes; and be quiet at last.",
  },
  { kind: "section-mark", text: "·  ·  ·" },
  { kind: "h2", text: "On the present moment" },
  {
    kind: "p",
    text: "Remember that man lives only in the present, in this fleeting instant: all the rest of his life is either past and gone, or not yet revealed. This mortal life is a little thing, lived in a little corner of the earth; and little, too, is the longest fame to come — dependent as it is on a succession of fast-perishing little men who have no knowledge even of their own selves.",
  },
  {
    kind: "p",
    text: "Confine thyself to the present. Whatever may happen to thee, it was prepared for thee from all eternity; and the implication of causes was from eternity spinning the thread of thy being, and of that which is incident to it.",
  },
  {
    kind: "p",
    text: "Let it be thy earnest and incessant care as a Roman and a man to perform whatsoever it is that thou art about, with true and unfeigned gravity, natural affection, freedom and justice; and as for all other cares and imaginations, how thou mayest ease thy mind of them. Which thou shalt do, if thou shalt go about every action as thy last action, free from all vanity, all passionate and wilful aberration from reason, and from all hypocrisy, and self-love, and dislike of those things, which by the fates or appointment of God have happened unto thee.",
  },
  { kind: "outro" },
];

const recap: AppData["recap"] = {
  takeaways: [
    "The most reliable retreat is not a place but a return to oneself.",
    "Lived experience exists only in the present moment — past and future are abstractions.",
    "Acceptance precedes equanimity: events were prepared from eternity.",
  ],
  quiz: [
    {
      q: 'What does Marcus mean by "retreat into thyself"?',
      choices: [
        "Physically withdrawing from public life",
        "A return to one's own principles and inner quiet",
        "Meditating in a remote place",
        "Avoiding difficult people",
      ],
      correct: 1,
    },
    {
      q: "Why is the present moment central to his thought?",
      choices: [
        "Because the past determines our future",
        "Because we cannot affect what is not yet here",
        "Because it is the only span we actually live",
        "Because memory is unreliable",
      ],
      correct: 2,
    },
  ],
  nextSession: { number: 9, title: "Of opinions, not things", readingTime: 12 },
};

const library: AppData["library"] = [
  {
    id: "meditations",
    title: "Meditations",
    author: "Marcus Aurelius",
    cover: { hue: 28, sat: 22, dark: 18, light: 88 },
    progress: 0.29,
    status: "Reading",
    lastRead: "Today",
  },
  {
    id: "walden",
    title: "Walden",
    author: "Henry David Thoreau",
    cover: { hue: 130, sat: 20, dark: 22, light: 84 },
    progress: 1,
    status: "Finished",
    lastRead: "Apr 14",
  },
  {
    id: "letters-stoic",
    title: "Letters from a Stoic",
    author: "Seneca",
    cover: { hue: 12, sat: 30, dark: 24, light: 86 },
    progress: 0.62,
    status: "Paused",
    lastRead: "Apr 22",
  },
  {
    id: "wealth-nations",
    title: "The Wealth of Nations",
    author: "Adam Smith",
    cover: { hue: 210, sat: 18, dark: 20, light: 86 },
    progress: 0.08,
    status: "Paused",
    lastRead: "Mar 3",
  },
  {
    id: "art-of-war",
    title: "The Art of War",
    author: "Sun Tzu",
    cover: { hue: 0, sat: 35, dark: 22, light: 84 },
    progress: 0,
    status: "Up next",
    lastRead: "—",
  },
  {
    id: "essays-emerson",
    title: "Self-Reliance & Other Essays",
    author: "Ralph Waldo Emerson",
    cover: { hue: 48, sat: 28, dark: 20, light: 86 },
    progress: 0,
    status: "Up next",
    lastRead: "—",
  },
];

// Deterministic 70-day streak ending today (no Math.random for SSR stability).
function buildDays(): AppData["days"] {
  const days: AppData["days"] = [];
  for (let i = 69; i >= 0; i--) {
    const d = new Date(TODAY);
    d.setDate(TODAY.getDate() - i);
    // Pseudo-random but deterministic from index — reproducible between server/client.
    const r = ((i * 9301 + 49297) % 233280) / 233280;
    const recencyBoost = (70 - i) / 70;
    let state: AppData["days"][number]["state"] = "miss";
    if (r < 0.25 + 0.5 * recencyBoost) state = "read";
    else if (r < 0.4 + 0.5 * recencyBoost) state = "light";
    if (i === 0) state = "today";
    days.push({ date: d, state });
  }
  // Force a 23-day streak ending today
  for (let k = 0; k < 23; k++) {
    days[days.length - 1 - k].state = k === 0 ? "today" : "read";
  }
  return days;
}

const stats: AppData["stats"] = {
  streak: 23,
  bestStreak: 41,
  booksFinished: 6,
  minutesThisWeek: 84,
  minutesGoalWeek: 90,
  avgSession: 13,
  weekly: [
    { day: "Mon", min: 12 },
    { day: "Tue", min: 14 },
    { day: "Wed", min: 0 },
    { day: "Thu", min: 18 },
    { day: "Fri", min: 12 },
    { day: "Sat", min: 16 },
    { day: "Sun", min: 12 },
  ],
};

const plan: AppData["plan"] = [
  { num: 1, title: "The duty of the day", chapter: "Book I", state: "done" },
  { num: 2, title: "Inheritance and gratitude", chapter: "Book I", state: "done" },
  { num: 3, title: "What governs the self", chapter: "Book II", state: "done" },
  { num: 4, title: "Of brief life", chapter: "Book II", state: "done" },
  { num: 5, title: "On opinion and disturbance", chapter: "Book III", state: "done" },
  { num: 6, title: "What is in our power", chapter: "Book III", state: "done" },
  { num: 7, title: "The discipline of assent", chapter: "Book III", state: "done", recap: true },
  { num: 8, title: "On returning to oneself", chapter: "Book IV", state: "today" },
  { num: 9, title: "Of opinions, not things", chapter: "Book IV", state: "next" },
  { num: 10, title: "Cause and substance", chapter: "Book IV", state: "next" },
  { num: 11, title: "On the common nature", chapter: "Book V", state: "next" },
  { num: 12, title: "Mid-book recap", chapter: "Recap", state: "next", recap: true },
  { num: 13, title: "On the rational soul", chapter: "Book V", state: "next" },
  { num: 14, title: "Time and oblivion", chapter: "Book VI", state: "next" },
  { num: 15, title: "On living straight", chapter: "Book VII", state: "next" },
  { num: 16, title: "Of patience with men", chapter: "Book VIII", state: "next" },
  { num: 17, title: "Acceptance of nature", chapter: "Book VIII", state: "next" },
  { num: 18, title: "Justice and reason", chapter: "Book IX", state: "next" },
  { num: 19, title: "Of one body", chapter: "Book X", state: "next" },
  { num: 20, title: "On simplicity", chapter: "Book X", state: "next" },
  { num: 21, title: "Of right action", chapter: "Book XI", state: "next" },
  { num: 22, title: "On the moment of death", chapter: "Book XII", state: "next" },
  { num: 23, title: "The whole and its parts", chapter: "Book XII", state: "next" },
  { num: 24, title: "Final reflections", chapter: "Recap", state: "next", recap: true },
];

export const APP_DATA: AppData = {
  activeBook,
  todayContent,
  recap,
  library,
  days: buildDays(),
  stats,
  plan,
  today: TODAY,
};

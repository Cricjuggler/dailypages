import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shade(hex: string, amt: number): string {
  const { r, g, b } = hexToRgb(hex);
  const adj = (c: number) => Math.max(0, Math.min(255, Math.round(c + 255 * amt)));
  return `#${[adj(r), adj(g), adj(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function hexA(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function formatGreetingDate(d: Date): string {
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const month = d.toLocaleDateString("en-US", { month: "short" });
  return `${weekday} · ${month} ${d.getDate()}`;
}

export function timeOfDayGreeting(d: Date): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function sessionPhrase(minutes: number): string {
  if (minutes <= 8) return `${minutes} quiet minutes are waiting.`;
  if (minutes <= 15) return `${spelled(minutes)} quiet minutes are waiting.`;
  if (minutes <= 25) return `A patient ${minutes}-minute window.`;
  return `${minutes} unhurried minutes — settle in.`;
}

function spelled(n: number): string {
  const map: Record<number, string> = {
    5: "Five", 6: "Six", 7: "Seven", 8: "Eight", 9: "Nine", 10: "Ten",
    11: "Eleven", 12: "Twelve", 13: "Thirteen", 14: "Fourteen", 15: "Fifteen",
  };
  return map[n] ?? String(n);
}

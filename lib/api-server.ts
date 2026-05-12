import "server-only";

import { auth } from "@clerk/nextjs/server";
import { API_BASE, HAS_BACKEND } from "@/lib/api-config";
import type {
  BookApi,
  PlanApi,
  PlanWithSessionsApi,
  SessionApi,
} from "@/lib/api-types";

/**
 * Server-side API helper. Uses Clerk's `auth()` to mint a session JWT and
 * forwards it to the FastAPI backend. Throws when the backend isn't configured
 * — callers should branch on HAS_BACKEND first.
 */
async function serverFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  if (!HAS_BACKEND) throw new Error("Backend not configured");
  const { getToken } = await auth();
  const token = await getToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let body = init?.body;
  if (init?.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const serverApi = {
  listBooks: () => serverFetch<BookApi[]>("/books"),
  getBook: (id: string) => serverFetch<BookApi>(`/books/${id}`),
  listPlansForBook: (bookId: string) =>
    serverFetch<PlanApi[]>(`/plans?book_id=${bookId}`),
  getPlan: (id: string) => serverFetch<PlanWithSessionsApi>(`/plans/${id}`),
  getSession: (id: string) => serverFetch<SessionApi>(`/sessions/${id}`),
};

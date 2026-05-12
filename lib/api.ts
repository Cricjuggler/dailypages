"use client";

import { API_BASE } from "@/lib/api-config";
import type {
  BookApi,
  PlanApi,
  PlanWithSessionsApi,
  ProgressApi,
  SessionApi,
  UploadCredentialsApi,
  UserApi,
} from "@/lib/api-types";

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

type Json = Record<string, unknown> | unknown[];

export type GetToken = () => Promise<string | null>;

async function request<T>(
  path: string,
  init: RequestInit & { json?: Json; getToken: GetToken },
): Promise<T> {
  if (!API_BASE) throw new ApiError(0, "NEXT_PUBLIC_API_URL not set");
  const { json, getToken, ...rest } = init;
  const headers = new Headers(rest.headers);
  const token = await getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    rest.body = JSON.stringify(json);
  }
  const res = await fetch(`${API_BASE}${path}`, { ...rest, headers });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = await res.text().catch(() => null);
    }
    const detail =
      typeof body === "object" && body && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : res.statusText;
    throw new ApiError(res.status, detail, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  me: (getToken: GetToken) => request<UserApi>("/auth/me", { method: "GET", getToken }),

  listBooks: (getToken: GetToken) => request<BookApi[]>("/books", { method: "GET", getToken }),

  getBook: (id: string, getToken: GetToken) =>
    request<BookApi>(`/books/${id}`, { method: "GET", getToken }),

  createUpload: (
    body: { title: string; author?: string; content_type: string; size_bytes?: number },
    getToken: GetToken,
  ) =>
    request<UploadCredentialsApi>("/books/upload", {
      method: "POST",
      json: body,
      getToken,
    }),

  /** Direct PUT to the presigned R2 URL — bypasses the backend. */
  uploadToR2: async (uploadUrl: string, file: File): Promise<void> => {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!res.ok) {
      throw new ApiError(res.status, `Upload to storage failed: ${res.statusText}`);
    }
  },

  processBook: (id: string, getToken: GetToken) =>
    request<BookApi>(`/books/${id}/process`, { method: "POST", getToken }),

  analyzeBook: (id: string, getToken: GetToken) =>
    request<BookApi>(`/books/${id}/analyze`, { method: "POST", getToken }),

  chatBook: (id: string, body: { question: string }, getToken: GetToken) =>
    request<{ answer: string; excerpts: { chapter: string; score: number }[] }>(
      `/books/${id}/chat`,
      { method: "POST", json: body, getToken },
    ),

  createPlan: (
    body: {
      book_id: string;
      minutes_per_session: number;
      target_sessions: number;
      depth: string;
      pace: string;
    },
    getToken: GetToken,
  ) => request<PlanApi>("/plans", { method: "POST", json: body, getToken }),

  /** Build a plan from raw chapters — no AI, instant. */
  planAsIs: (
    bookId: string,
    body: { minutes_per_session?: number; pace?: string },
    getToken: GetToken,
  ) =>
    request<PlanApi>(`/books/${bookId}/plan-as-is`, {
      method: "POST",
      json: body,
      getToken,
    }),

  generatePlan: (id: string, getToken: GetToken) =>
    request<PlanApi>(`/plans/${id}/generate`, { method: "POST", getToken }),

  getPlan: (id: string, getToken: GetToken) =>
    request<PlanWithSessionsApi>(`/plans/${id}`, { method: "GET", getToken }),

  getSession: (id: string, getToken: GetToken) =>
    request<SessionApi>(`/sessions/${id}`, { method: "GET", getToken }),

  updateProgress: (
    id: string,
    body: {
      completion_percentage: number;
      last_read_position: number;
      elapsed_sec: number;
      highlights?: number[];
    },
    getToken: GetToken,
  ) =>
    request<ProgressApi>(`/sessions/${id}/progress`, {
      method: "PUT",
      json: body,
      getToken,
    }),

  completeSession: (id: string, getToken: GetToken) =>
    request<ProgressApi>(`/sessions/${id}/complete`, { method: "POST", getToken }),
};

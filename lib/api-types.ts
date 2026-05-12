/** Mirrors backend Pydantic schemas. Keep in sync with backend/app/schemas/. */

export type BookStatus = "pending" | "parsing" | "ready" | "failed";
export type Depth = "quick" | "balanced" | "deep";
export type Pace = "sprint" | "steady" | "gentle";

export interface CoverParamsApi {
  hue: number;
  sat: number;
  dark: number;
  light: number;
}

export interface BookApi {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  pages: number | null;
  status: BookStatus;
  cover_params: CoverParamsApi | null;
  cover_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface UploadCredentialsApi {
  book_id: string;
  upload_url: string;
  storage_key: string;
  expires_in: number;
}

export interface PlanApi {
  id: string;
  user_id: string;
  book_id: string;
  minutes_per_session: number;
  total_sessions: number;
  total_days: number;
  depth: Depth;
  pace: Pace;
  created_at: string;
  updated_at: string;
}

export interface SessionSummaryApi {
  id: string;
  session_number: number;
  title: string;
  chapter: string | null;
  estimated_minutes: number;
}

export interface PlanWithSessionsApi extends PlanApi {
  sessions: SessionSummaryApi[];
}

export interface SessionApi extends SessionSummaryApi {
  reading_plan_id: string;
  content_blocks: unknown[] | null;
  recap: unknown | null;
  quiz: unknown[] | null;
  created_at: string;
  updated_at: string;
}

export interface ProgressApi {
  id: string;
  user_id: string;
  session_id: string;
  completion_percentage: number;
  completed: boolean;
  last_read_position: number;
  elapsed_sec: number;
  highlights: number[] | null;
  created_at: string;
  updated_at: string;
}

export interface UserApi {
  id: string;
  clerk_user_id: string;
  email: string;
  name: string | null;
  created_at: string;
  updated_at: string;
}

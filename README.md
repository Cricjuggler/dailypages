# DailyPages

AI-paced reading companion. Books, one quiet session at a time.

## Status — Phase 6 (MVP complete)

- **Phase 1** ✓ Frontend foundation, design system, Library, Upload (mocked)
- **Phase 2** ✓ Reader (hero), Plan, Personalize, Recap, Progress
- **Phase 3** ✓ Backend skeleton — FastAPI, Postgres + pgvector, Clerk auth, R2 signed uploads, CRUD routes
- **Phase 4** ✓ Parsing pipeline — pypdf + pdfminer + ebooklib, Celery + Redis worker. Frontend API client + Clerk + real round-trip upload.
- **Phase 5** ✓ AI agents — Claude + Voyage. Semantic, style, planner, rewriter, quiz, RAG chat. Tasks chain `parse → analyze → generate sessions`.
- **Phase 6** ✓ Streaming explain (SSE), dynamic routes for real session content, server-side API client with Clerk `auth()`, Redis-backed rate limiting on AI endpoints, structured JSON logging in production.

## Layout

```
.
├── app/                # Next.js 15 routes
├── components/         # UI components
├── lib/                # types, mock data, prefs store, helpers
├── backend/            # FastAPI service (see backend/README.md)
└── _extracted/         # original design handoff (gitignored, kept on disk)
```

## Frontend — run

```sh
npm install
npm run dev
```

Open http://localhost:3000. All 7 screens are wired against mock data in [lib/mock-data.ts](lib/mock-data.ts). Themes (paper/sepia/dark), accents, font, reader size, and session length all persist via the floating tweaks panel.

## Backend — run

```sh
cd backend
cp .env.example .env             # fill in Clerk + R2 values
docker compose up -d db          # local Postgres with pgvector

python -m venv .venv && .\.venv\Scripts\Activate.ps1
pip install -e .
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/docs for the OpenAPI explorer. Full setup including Neon, R2, and Render deployment lives in [backend/README.md](backend/README.md).

## End-to-end user flow (with backend configured)

1. Sign in at `/sign-in` (Clerk).
2. `/upload` — pick a PDF/EPUB. Presigned PUT to R2 → `/books/{id}/process` queues a Celery job. The worker parses the file and chains `analyze_book` automatically (embeddings + concepts + style profile) when AI keys are present.
3. `/personalize?bookId=…` — pick session length, pace, depth. Submitting calls `POST /plans` and `POST /plans/{id}/generate` (planner → rewriter → quiz, async).
4. `/plan/{planId}` — server-rendered plan with the generated sessions.
5. `/reader/{sessionId}` — server-rendered typed prose blocks (the same JSON the mock Reader uses). Right-click any paragraph → SSE stream from `/sessions/{id}/explain`. Suggestion chips ("More like this", "An example", "Compare to Seneca") re-stream with the chosen intent.
6. `/recap/{sessionId}` — takeaways + quiz pulled from the session row.
7. `/books/{id}/chat` — RAG-grounded chat over chapter embeddings. Rate-limited to 15 rpm/user (chat) and 20 rpm/user (explain).

Without backend env configured, the design demo runs from [lib/mock-data.ts](lib/mock-data.ts). The static routes (`/plan`, `/reader`, `/recap`) keep working as the mock demo; the dynamic `[planId]`, `[sessionId]` routes are the real-data paths.

## Design tokens

Themes: `paper` (default), `sepia`, `dark`. Accent swatches: terracotta, forest, ocean, gold, plum. Reader font: serif / sans / mono. The paper-grain body overlay is what differentiates the look from a generic SaaS app — don't remove it.

# DailyPages — Backend

FastAPI + async SQLAlchemy + Postgres (pgvector) + Clerk + R2.

## Status — Phase 5

Full pipeline: **upload → parse → analyze → plan → generate sessions → read → chat**. All endpoints land here; the frontend Reader/Plan/Recap screens still render from `lib/mock-data.ts` and get wired up next phase.

Pipeline:
- `POST /books/{id}/process` parses the source (pypdf outline + pdfminer text, or ebooklib for EPUB) → writes `chapters` rows.
- On success, the worker chains `analyze_book` automatically when `ANTHROPIC_API_KEY` and `VOYAGE_API_KEY` are set: per-chapter Voyage embeddings + Claude concept/complexity scoring + a single Claude pass for a book-level **style profile**.
- `POST /plans` creates a `ReadingPlan` from the book + user prefs (math matches the frontend Personalize screen exactly).
- `POST /plans/{id}/generate` runs **planner → rewriter → quiz** in a Celery task: chapters → session boundaries → typed prose blocks (the same JSON the Reader expects) → recap takeaways + 2-question quiz. Idempotent.
- `POST /books/{id}/chat` runs **RAG**: Voyage `embed_query` → pgvector cosine search of the top 4 chapters → Claude answer with citations.
- `POST /books/{id}/analyze` lets you re-run the analysis pass after tuning prompts/models.

The `/books/{id}/process` and `/plans/{id}/generate` calls return `202 Accepted`; the frontend polls `GET /books/{id}` and `GET /plans/{id}` to follow status. Without AI keys configured, parsing still works — the analyze/generate/chat endpoints return `503` with a clear message and the chain skips the AI steps.

## Run locally

```sh
cd backend
cp .env.example .env             # fill in CLERK_* and R2_* values

# Local Postgres (with pgvector preinstalled) + Redis
docker compose up -d db redis

# Python deps
python -m venv .venv && .\.venv\Scripts\Activate.ps1
pip install -e .

# Migrations
alembic upgrade head

# Serve API
uvicorn app.main:app --reload --port 8000

# In a separate terminal — start the parsing worker
celery -A app.worker worker --loglevel=INFO --concurrency=2
```

Open http://localhost:8000/docs for the interactive API docs.

Or run everything (db + redis + api + worker) via Docker:

```sh
docker compose up --build
```

## Routes

| Method | Path | Phase | Notes |
|---|---|---|---|
| `GET` | `/healthz` | 3 | Liveness |
| `GET` | `/readyz` | 3 | DB ping + which integrations are configured |
| `GET` | `/auth/me` | 3 | Verifies bearer token, upserts local user row |
| `GET` | `/books` | 3 | List user's books |
| `POST` | `/books/upload` | 3 | Reserves a Book row, returns presigned R2 URL |
| `GET` | `/books/{id}` | 3 | Book detail |
| `POST` | `/books/{id}/process` | 4 | Queues parsing (202); chains analyze when AI is configured |
| `POST` | `/books/{id}/analyze` | 5 | Re-run AI analysis (embeddings + concepts + style) |
| `POST` | `/books/{id}/chat` | 5 | Grounded RAG chat over chapter embeddings |
| `POST` | `/plans/{id}/generate` | 5 | Queues session generation (planner → rewriter → quiz) |
| `POST` | `/plans` | 3 | Create reading plan |
| `GET` | `/plans/{id}` | 3 | Plan + sessions |
| `GET` | `/sessions/{id}` | 3 | Session content |
| `PUT` | `/sessions/{id}/progress` | 3 | Save read position / elapsed / highlights |
| `POST` | `/sessions/{id}/complete` | 3 | Mark session complete |

## Deploy

### Database — Neon

Create a project at [neon.tech](https://neon.tech), enable the **vector** extension (or rely on the Alembic migration to do it), copy the connection string. Use the **pooled** connection for the app and the **direct** connection for migrations if you separate them later.

Adjust the URL prefix:

```
postgresql+asyncpg://user:pass@host/db?sslmode=require
```

### File storage — Cloudflare R2

Create an R2 bucket. Generate an API token with read+write scope to that bucket. Copy the account ID, access key, and secret. Optionally configure a public custom domain for served images and put it in `R2_PUBLIC_BASE`.

### Auth — Clerk

Create an application at [clerk.com](https://clerk.com). From the **API Keys** page, copy:

- `CLERK_ISSUER` — looks like `https://YOUR-INSTANCE.clerk.accounts.dev`
- `CLERK_JWKS_URL` — `${ISSUER}/.well-known/jwks.json`
- `CLERK_AUDIENCE` — only set if you've configured an Audience in Clerk; otherwise leave empty

### Service — Render

`render.yaml` is a Blueprint. Connect this repo on Render → **New → Blueprint** → pick the repo. Render will detect the file and let you fill in the marked-secret env vars.

Render's free tier was deprecated for new web services in late 2024 — the default is the **starter** plan. For a truly free option, swap in [Fly.io](https://fly.io) (free allowance) or [Railway](https://railway.app); the Dockerfile is portable.

## Layout

```
backend/
├── alembic/                 # migrations (env.py + 0001_initial)
├── app/
│   ├── main.py              # FastAPI factory, CORS, route registration
│   ├── config.py            # pydantic-settings (.env)
│   ├── db.py                # async engine + session
│   ├── auth.py              # Clerk JWT verification
│   ├── storage.py           # R2 presigned URLs
│   ├── models/              # SQLAlchemy ORM
│   ├── schemas/             # Pydantic I/O
│   └── routers/             # health, users, books, plans, sessions
├── alembic.ini
├── Dockerfile
├── docker-compose.yml       # local Postgres + API
├── pyproject.toml
└── render.yaml              # Blueprint
```

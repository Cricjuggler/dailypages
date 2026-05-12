FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY pyproject.toml ./
RUN pip install --upgrade pip && \
    pip install . && \
    pip install gunicorn

# Source
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./

# Render injects PORT; default to 8000 locally
ENV PORT=8000
EXPOSE 8000

# Run migrations on startup, then serve.
CMD alembic upgrade head && \
    uvicorn app.main:app --host 0.0.0.0 --port "${PORT}" --workers 2

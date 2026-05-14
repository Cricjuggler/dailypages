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
    pip install .

# Source
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
COPY start.sh ./
RUN chmod +x ./start.sh

# Render injects PORT; default to 8000 locally
ENV PORT=8000
EXPOSE 8000

# One container runs migrations, API, and Celery worker together. The script
# handles signals so SIGTERM kills both children cleanly. Split into two
# services if you outgrow the free tier.
CMD ["./start.sh"]

#!/usr/bin/env bash
# Single-container start for Render's free web-service tier.
#
# Runs Alembic migrations first, then API + worker as sibling processes.
# Either process dying kills the container so Render restarts the whole
# thing clean. For higher-traffic deploys, split these into two services.
set -e

echo "==> Applying database migrations"
alembic upgrade head

PORT="${PORT:-8000}"

echo "==> Starting Celery worker (solo pool)"
celery -A app.worker worker --loglevel=INFO --concurrency=1 --pool=solo &
CELERY_PID=$!

echo "==> Starting FastAPI on :$PORT"
uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --workers 1 &
UVICORN_PID=$!

shutdown() {
    echo "==> Shutting down (worker=$CELERY_PID, api=$UVICORN_PID)"
    kill -TERM "$CELERY_PID" "$UVICORN_PID" 2>/dev/null || true
    wait 2>/dev/null || true
}
trap shutdown SIGTERM SIGINT

# Exit when whichever child exits first; the trap kills the survivor.
wait -n
EXIT_CODE=$?
shutdown
exit "$EXIT_CODE"

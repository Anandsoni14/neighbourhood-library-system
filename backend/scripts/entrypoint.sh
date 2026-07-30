#!/bin/bash
# Container entrypoint: wait for Postgres, migrate, optionally seed, then run
# the actual command (the Dockerfile's CMD).
#
# Deliberately NOT a FastAPI lifespan hook:
#   1. `fastapi run` may start multiple worker processes; a lifespan hook runs
#      once per worker, racing N `alembic upgrade head` on the alembic_version
#      row and N seed runs on the same unique constraints.
#   2. tests/conftest.py calls create_app() once per test (~200 times); this
#      script is simply never invoked by pytest, so there's no risk of it
#      running mid-test-suite and needing an env guard to prevent that.
#   3. A failed migration here exits non-zero with a legible log line, rather
#      than a half-initialised app serving 500s.
set -euo pipefail

echo "[entrypoint] waiting for the database..."
attempt=0
until uv run --no-sync python -c "
import sys
import psycopg
from core.config import get_settings
url = get_settings().database_url.replace('postgresql+psycopg://', 'postgresql://', 1)
try:
    psycopg.connect(url, connect_timeout=3).close()
except Exception:
    sys.exit(1)
"; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "[entrypoint] database did not become reachable after 30 attempts" >&2
    exit 1
  fi
  echo "[entrypoint] database not ready yet, retrying ($attempt/30)..."
  sleep 2
done
echo "[entrypoint] database is reachable."

echo "[entrypoint] running migrations..."
uv run --no-sync alembic upgrade head

if [ "${SEED_SAMPLE_DATA:-false}" = "true" ]; then
  echo "[entrypoint] seeding sample data..."
  uv run --no-sync python -m scripts.seed
fi

exec "$@"

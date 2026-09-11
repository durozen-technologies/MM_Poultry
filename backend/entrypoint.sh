#!/bin/bash
set -e

echo "[entrypoint] Waiting for DB..."
until python -c "import psycopg; psycopg.connect(conninfo=\"host=${POSTGRES_SERVER:-db} port=${POSTGRES_PORT:-5432} dbname=${POSTGRES_DB:-MM_Poultry} user=${POSTGRES_USER:-postgres} password=${POSTGRES_PASSWORD:-root} connect_timeout=2\").close()" 2>/dev/null; do
  sleep 1
done
echo "[entrypoint] DB reachable."

echo "[entrypoint] Running alembic upgrade head..."
alembic -c alembic.ini upgrade head

echo "[entrypoint] Repairing tenant schemas..."
python migrate.py || echo "[entrypoint] migrate.py warning (non-fatal)"

echo "[entrypoint] Starting API..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'

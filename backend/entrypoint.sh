#!/bin/bash
set -e

# Resilient DB migration entrypoint:
# - Handles volume that was provisioned via `manage.py setup` (tables exist but no alembic_version)
# - Upgrades head; on DuplicateTable falls back to stamping head
# - Repairs tenant schemas after migration

echo "[entrypoint] Waiting for DB..."
until python -c "import psycopg; psycopg.connect(conninfo=\"host=${POSTGRES_SERVER:-db} port=${POSTGRES_PORT:-5432} dbname=${POSTGRES_DB:-MM_Poultry} user=${POSTGRES_USER:-postgres} password=${POSTGRES_PASSWORD:-root} connect_timeout=2\").close()" 2>/dev/null; do
  sleep 1
done
echo "[entrypoint] DB reachable."

# Detect whether public schema already exists without alembic_version
NEEDS_STAMP=$(python -c "
import psycopg
try:
    conn = psycopg.connect(host='${POSTGRES_SERVER:-db}', port=${POSTGRES_PORT:-5432}, dbname='${POSTGRES_DB:-MM_Poultry}', user='${POSTGRES_USER:-postgres}', password='${POSTGRES_PASSWORD:-root}')
    cur = conn.cursor()
    cur.execute(\"SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='organizations')\")
    has_org = cur.fetchone()[0]
    cur.execute(\"SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='alembic_version')\")
    has_ver = cur.fetchone()[0]
    if has_org and not has_ver:
        print('stamp')
    elif has_ver:
        cur.execute('SELECT version_num FROM public.alembic_version')
        rows = [r[0] for r in cur.fetchall()]
        # If version table exists but is empty, we need to stamp
        if not rows:
            print('stamp')
        else:
            print('upgrade')
    else:
        print('upgrade')
    conn.close()
except Exception as e:
    print(f'upgrade:{e}')
" 2>&1 | tail -n1)

echo "[entrypoint] migration mode: $NEEDS_STAMP"

if [ "$NEEDS_STAMP" = "stamp" ]; then
  echo "[entrypoint] Detected existing tables without alembic_version -> stamping head..."
  # Stamp public head; tenant schemas will be stamped by repair
  alembic -c alembic.ini stamp head || true
fi

echo "[entrypoint] Running alembic upgrade head..."
if ! alembic -c alembic.ini upgrade head; then
  echo "[entrypoint] upgrade failed, attempting stamp+upgrade fallback..."
  alembic -c alembic.ini stamp head || true
  alembic -c alembic.ini upgrade head || {
    echo "[entrypoint] FATAL: migration still failing"
    exit 1
  }
fi

echo "[entrypoint] Repairing tenant schemas..."
python migrate.py || echo "[entrypoint] migrate.py warning (non-fatal)"

echo "[entrypoint] Starting API..."
exec uvicorn main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'

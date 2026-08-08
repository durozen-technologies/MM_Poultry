# Broiler Wholesale API

## Setup

```bash
cd backend
cp .env.example .env
uv sync
# create DB once: createdb mmbroilers  (or via psql)
uv run python migrate.py
uv run python seed.py
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Health: `GET /api/v1/health`

See `.core/TEST_CREDENTIALS.md` for demo logins (`organization_slug`: `demo` when needed).

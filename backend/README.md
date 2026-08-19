# Broiler Wholesale API

## Setup

```bash
cd backend
cp .env.example .env
uv sync
# create DB once: createdb MM_Poultry  (or via psql)
uv run python migrate.py
uv run python seed.py
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Tests

Requires PostgreSQL (`createdb mmbroilers_test`):

```bash
cd backend
POSTGRES_DB=mmbroilers_test SECRET_KEY=test-secret-key-with-32-chars-minimum uv run pytest
uv run ruff check app
```

Health: `GET /api/v1/health`

See `.core/TEST_CREDENTIALS.md` for demo logins (`organization_slug`: `demo` when needed).

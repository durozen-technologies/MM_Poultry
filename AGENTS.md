# AGENTS.md

## Stack & Layout
- Monorepo, no workspace manager: `backend/` (FastAPI) + `frontend/` (Expo 57) + `compose.yaml`. No `opencode.json` — this file is the agent entry point.
- Backend: FastAPI + SQLAlchemy 2 async + `asyncpg`/`psycopg` + Alembic, Python `>=3.11.9`, `uv` only. Entry: `backend/app/main.py:create_app()` (`backend/main.py` re-exports `app`).
- Frontend: Expo 57 / React Native 0.86 / React 19 / TypeScript strict, Zustand + TanStack Query + NativeWind. Path alias `@/*` → `frontend/src/*`. Entry: `frontend/App.tsx`.
- Docs harness: `.core/` — `ARCHITECTURE.md`, `DATA_MODELS.md`, `RULES.md`, `ADMIN_PLAN.md`, `TEST_CREDENTIALS.md` (demo org slug `demo`). **Consult `.core/` before planning**; historical docs are append-only, never overwrite.
- Reference pattern: `D:\POS\Duro_POS` (schema-per-tenant ADR-003). Bindings live in `backend/app/db/database.py:17` and `backend/app/db/tenant_schema.py:18`.

## Setup & Run
```bash
# Backend — needs PostgreSQL + uv
cd backend
cp .env.example .env          # set SECRET_KEY (>=32 chars), POSTGRES_* — see app/core/config.py:72
uv sync
uv run python manage.py setup                           # creates public tables via app/db/tenant_schema.py:create_platform_tables
uv run python manage.py createsuperadmin --username admin --password <pw>  # public schema, app/db/tenant_schema.py:set_search_path(null)
uv run uvicorn app.main:app --reload --port 8000        # or --host 0.0.0.0; settings at backend/app/core/config.py:12

# Frontend — use bun, never npm/npx/node unless tool forces it
cd frontend
bun install
cp .env.example .env            # EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 (emulator: 10.0.2.2, device: LAN IP)
bun run web                     # web target; app targets need Expo Go SDK 57 or dev-client
bun run start:dev               # BLE/printer flows require dev-client (Expo Go is UI+API only)
```

Docker: `docker compose up` — `backend/entrypoint.sh:9` waits for DB, stamps `alembic_version` if `manage.py setup` left it empty, runs `alembic upgrade head`, then `python migrate.py:18` to repair tenant schemas. Health: `GET /api/v1/health` (`backend/app/main.py:73`). Compose `expose:8000` + `ports: ${BACKEND_HOST_PORT:-8001}:8000` (`compose.yaml:16`); local `.env` sets `BACKEND_HOST_PORT=8000`, Dokploy (no `.env`) defaults to `8001` to avoid gateway `0.0.0.0:8000` collision. `env_file` is `required:false` with DB fallback defaults (`compose.yaml:32`).

## Backend Quirks (verify before changing)
- **Tenancy:** `public` = `organizations`, `user_auth_index`, `users` (platform). Each wholesaler = `tenant_<slug>` (`backend/app/db/tenant_schema.py:23` `derive_schema_name`, capped 63 chars, regex `^[a-zA-Z_][a-zA-Z0-9_]*$`). Tenant provisioning: `provision_tenant_schema_async` + stamp `TENANT_MIGRATION_HEAD="36325e542abe"` — does not replay migrations.
- **DB session:** Always `SET TIME ZONE 'Asia/Kolkata'` + `RESET search_path` then `SET search_path TO "<tenant>", public` (`tenant_schema.py:36`). Pool safety via `NullPool` when `POSTGRES_DB` ends with `_test` (`app/db/database.py:35`) plus `tenant_context_var` + `reset_search_path` on checkout. Use `tenant_schema_scope()` for tenant work.
- **Config:** `pydantic-settings` loads `backend/.env` (`app/core/config.py:33`). `SECRET_KEY` min 32 in `PRODUCTION=true`; `CORS_ORIGINS`/`ALLOWED_HOSTS` defaults `*`/`localhost,127.0.0.1` — production validators reject `*`. Env names are `POSTGRES_*` (not `DATABASE_URL`).
- **IDs/time:** Prefer `uuid7` (`app/core/`). All business dates IST. API date strings **DD/MM/YYYY**; frontend must use shared `DatePickerField` + `formatIstDate`/`toApiDate`.
- **Errors/lists:** Structured `{ error: { code, message, details? } }` handlers at `app/main.py:45`. Lists are cursor-paginated only (`limit`, `has_more`, `next_cursor_*`).
- **Auth:** `user_auth_index.username_lower` is globally unique (`tenant_schema.py:222`). Login disambiguates colliding usernames via optional `organization_slug` header/body. `app/auth/dependencies.py:get_current_auth`.
- **Billing:** `delivery_bills.checkout_id` unique for idempotency, `weigh → commit (PRINT_PENDING) → print → PATCH print-status`. `TrustedHostMiddleware` skipped when `postgres_db` endswith `_test` (`app/main.py:54`).

## Frontend Quirks
- Package manager is `bun` (`frontend/package.json:14` scripts). `lint` (`eslint`) and `typecheck` (`tsc --noEmit`) are the CI gates — no test suite on frontend (`frontend/.github/frontend-ci.yml:24`).
- `EXPO_PUBLIC_API_BASE_URL` is baked at Metro start; leaving GitHub Actions input blank for debug APK (`frontend/README.md:15` pattern) and setting it in local `frontend/.env` + `bun run start:dev` is the intended local APK flow.
- BLE scale (`react-native-ble-plx`) and thermal print (`@haroldtran/react-native-thermal-printer`) have web/iOS graceful fallbacks — never fake success on print.
- Local APK build: `bun run build:debug-apk` requires JDK 17 + Android SDK (`frontend/scripts/build-debug-apk.sh`). CI APKs via `.github/workflows/build-android-debug.yml`.

## Tests — Two Separate Suites, Both Need Postgres
- **Primary suite (most complete):** `test/` run from `backend/` with `AsyncClient`+`ASGITransport` (`test/conftest.py:60`). Single-test: `POSTGRES_DB=mmbroilers_test SECRET_KEY=test-secret-key-with-32-chars-minimum uv run pytest test/integration/test_billing_ledger.py -v`
- **Legacy suite:** `backend/tests/` uses `TestClient` + `mock_admin_auth` / `mock_super_admin_auth` dependency overrides (`backend/tests/conftest.py:91`). Hard-codes `POSTGRES_DB=MM_Poultry_test` (note caps) at `backend/tests/conftest.py:14` — conflicts with `mmbroilers_test` used by CI (`backend-ci.yml:32`) and `test/`. Prefer `test/` for new work; if running both in parallel, expect `reset_test_database_async` deadlock retry (`tenant_schema.py:90`, `test/conftest.py:40`).
- Both suites require a real Postgres DB (`createdb mmbroilers_test` or `MM_Poultry_test`) and `_test` suffix to disable `TrustedHostMiddleware` and enable `NullPool`. CI runs `uv run pytest -q` from `backend/` with `pytest.ini_options.testpaths = ["tests", "../test"]` (`pyproject.toml:41`).
- Unit-only (no DB): `uv run pytest test/unit -v` (`test_ids_timezone`, `test_username_availability`, etc.).
- Every new endpoint under `backend/app/routers/` must ship with a test in `backend/tests/` or `test/` (happy path + error case) — rule from `.agents/AGENTS.md:44`.

## Lint / Typecheck / CI Order
Backend CI (`.github/workflows/backend-ci.yml:43`) runs in order: `uv run ruff check app` (`pyproject.toml:30` `target-version py311`, `line-length 100`, `select E,F,I`) → `uv run mypy app/` → `uv run pytest -q`. Keep order when verifying locally. Frontend CI: `bun run typecheck` only.

## Migrations — Dual Alembic Chains
- Config: `backend/alembic.ini:4` `version_locations = migrations/versions/public:migrations/versions/tenant`. Filters `include_object_public`/`tenant` by `_platform_table_names`/`_tenant_table_names` (`tenant_schema.py:59`).
- **Never mix paths:** Public schema = `alembic -c alembic.ini upgrade head` (or `ALEMBIC_MODE=public`). Tenant schemas = provisioned via `provision_tenant_schema_async` or repaired via `migrate.py` (`repair_tenant_schema_async` / `repair_platform_schema_async`). `manage.py setup` only creates `public` tables; `migrate.py` repairs existing tenants. Bump `TENANT_MIGRATION_HEAD` when adding tenant revisions.
- `alembic` public path uses `sync_database_url` (`psycopg`, `backend/app/core/config.py:69`). Tenant online migrations discover schemas via `SELECT slug FROM organizations` → `derive_schema_name` (`migrations/env.py:199`).

## Workflow Constraints
- Do not push to git or trigger CI unprompted (`.core/RULES.md:42`). Workflows are `push: [main, dev]` + `workflow_dispatch`.
- Never commit `.env` / secrets; `.core/pending_issues/` is gitignored. `tasks/` exists for local notes.
- Map `d:\MMbroliers\.core\*` paths in `.agents/AGENTS.md:5` to repo-root `.core/*` on Linux.
- Demo creds: `.core/TEST_CREDENTIALS.md` — tenant logins need `organization_slug=demo`.

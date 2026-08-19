# Broiler Wholesale root

Mobile-first broiler wholesale management (orders → farm load → BLE delivery weigh → thermal bill → ledger → trip weight loss).

| Path | Role |
|------|------|
| `backend/` | FastAPI + schema-per-tenant PostgreSQL |
| `frontend/` | Expo React Native app |
| `caddy/` | Reverse proxy stub |
| `test/` | Unit + API contract tests |
| `.core/` | Architecture / models / session logs |
| `MM_Poultry_Documentation.md` | Product brief and documentation |

## Quick start

```bash
# Backend (API)
cd backend
uv sync
uv run python manage.py setup
uv run python manage.py createsuperadmin --username admin --password yourpassword
uv run uvicorn app.main:app --reload --port 8000

# Frontend (Mobile/Web)
cd frontend
bun install
bun run web
```

Demo credentials: `.core/TEST_CREDENTIALS.md` (tenant users need `organization_slug=demo`).

## Debug APK (GitHub Actions)

Workflow: [`.github/workflows/build-android-debug.yml`](.github/workflows/build-android-debug.yml)

1. Push to `main` / `dev`, or run **Actions → Build Debug APK (Development) → Run workflow**.
2. Leave the API URL input **blank** (recommended). Keep `EXPO_PUBLIC_API_BASE_URL` in laptop `frontend/.env` — Metro picks it up with `npm run start:dev`.
3. Optional: fill the workflow input / secret only if you want a URL baked into that APK build.
4. Download the `mmbroliers-debug-*` artifact (`app-debug.apk`), install on Android, then:

```bash
cd frontend
# frontend/.env already has EXPO_PUBLIC_API_BASE_URL=...
bun run start:dev
```

Local APK build (JDK 17 + Android SDK):

```bash
cd frontend
bun run build:debug-apk
```

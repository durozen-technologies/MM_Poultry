# Broiler Wholesale root

Mobile-first broiler wholesale management (orders → farm load → BLE delivery weigh → thermal bill → ledger → trip weight loss).

| Path | Role |
|------|------|
| `backend/` | FastAPI + schema-per-tenant PostgreSQL |
| `frontend/` | Expo React Native app |
| `caddy/` | Reverse proxy stub |
| `test/` | Unit + API contract tests |
| `.core/` | Architecture / models / session logs |
| `Broiler_Wholesale_App_Proposal.md` | Product brief |

## Quick start

```bash
# API
cd backend
uv sync
uv run python migrate.py
uv run python seed.py
uv run uvicorn main:app --reload --port 8000

# App
cd frontend
npm install
npm run web
```

Demo credentials: `.core/TEST_CREDENTIALS.md` (tenant users need `organization_slug=demo`).

## Debug APK (GitHub Actions)

Workflow: [`.github/workflows/apk-debug.yml`](.github/workflows/apk-debug.yml)

1. Push to `main` / `dev`, or run **Actions → Build Debug APK (Development) → Run workflow**.
2. Optional input / secret: `EXPO_PUBLIC_API_BASE_URL` (LAN IP for real devices, e.g. `http://10.x.x.x:8000`).
3. Download the `mmbroilers-debug-*` artifact (`app-debug.apk`).
4. Install on Android, then start Metro: `cd frontend && npm run start:dev`.

Local equivalent (JDK 17 + Android SDK required):

```bash
cd frontend
export EXPO_PUBLIC_API_BASE_URL=http://10.x.x.x:8000
npm run build:debug-apk
```

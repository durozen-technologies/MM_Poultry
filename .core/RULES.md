# Broiler Wholesale Coding Rules & Constraints

*Supersedes LedgerDesk-era rules for new work. Historical LedgerDesk constraints lived in prior revisions of this file intent; this rewrite aligns with Duro_POS + `MM_Poultry_Documentation.md`.*

## 1. Python Backend (FastAPI)

- **Type Hinting:** Strict type hints on all function arguments and return types.
- **Dependency Management:** Use `uv` for resolving and installing Python packages.
- **Database Safety:** Dependency-injected `AsyncSession`; never leak sessions. Use `tenant_schema_scope()` / pool-safe `search_path` (RESET on begin).
- **Migrations:** All schema changes via Alembic. Platform chain + tenant chain. After model changes run `migrate.py`; bump `TENANT_MIGRATION_HEAD` when adding tenant revisions. Never hand-edit prod tables.
- **Errors:** Return `{ "error": { "code", "message", "details?" } }` — not raw FastAPI `detail`.
- **Lists:** Cursor pagination only; no unbounded list endpoints.
- **IDs / time:** Prefer uuid7. **Indian Standard Time (IST, Asia/Kolkata) is the only business timezone.** DB sessions must `SET TIME ZONE 'Asia/Kolkata'`. Timestamps are written with `now_ist()`. Calendar dates and API date strings use **DD/MM/YYYY** only.
- **Date inputs (frontend):** Always use the shared `DatePickerField` (native datepicker). Never free-type dates. Display with `formatIstDate` / `toApiDate`.

## 2. Frontend (Expo React Native)

- **Language:** TypeScript (`.tsx`) only.
- **Package Manager:** Use `bun` instead of `npm`, `npx`, or `node`.
- **Stack:** Expo 54 patterns from Duro_POS — NativeWind, Zustand for client state, React Navigation.
- **API data:** Prefer explicit API modules + hooks; mirror DTOs in `frontend/src/types/`.
- **Hardware:** Bluetooth scale via BLE (`react-native-ble-plx`); thermal ESC/POS on Android. Web/iOS get graceful fallbacks (no fake success on print).
- **Architecture:** Functional components + hooks.

## 3. Business Logic Constraints (Broiler Wholesale)

**CRITICAL RULE: DO NOT OVERCOMPLICATE.**

- **Tenancy:** Schema-per-tenant PostgreSQL (Duro_POS ADR-003). Do not invent a second tenancy model.
- **Workflow order:** Retailer daily order → wholesaler dashboard → farm load → delivery run/stops → BLE weigh → print/commit bill → ledger → trip weight loss.
- **Weight source of truth at delivery:** Scale reading (manual override only with explicit reason/role).
- **Trip weight loss:** `loaded_kg - sum(delivered_kg)` per farm load / run. Do not conflate with overnight inventory grams/day loss unless explicitly scheduled later.
- **Ledger:** Retailer `opening_balance` + `credit_balance`. Bills increase outstanding; payments decrease it. Cash + UPI tracked separately.
- **Bill numbers:** Stable sequences (e.g. `DEL-YYYY-000001`), reset yearly — same spirit as prior PUR/SAL idea.
- **WhatsApp:** Client-side share of bill text/PDF; do not block billing if WhatsApp fails.
- **No multi-branch / GPS / route optimization in v1** — listed as future in the proposal.

## 4. System Operations & CI/CD

**CRITICAL RULE: REPOSITORY DISCIPLINE.**

- **No Unprompted Pushes:** NEVER push to git or trigger CI unless the user EXPLICITLY asks.
- **Manual CI:** Prefer manually triggered workflows when added.
- **Secrets:** Never commit `.env`, credentials, or device pairing secrets.

## 5. Strict Documentation Preservation

**CRITICAL RULE: DO NOT ERASE HISTORY.**

- Log every action, chat, and command into `SESSION_HISTORY.md` and `CHAT_LOG.md`.
- Append ideas/features to `IDEA.md`.
- When architecture or data models change, **append** timestamped sections to `ARCHITECTURE.md` and `DATA_MODELS.md`. Never overwrite historical states.
- Always consult `.core/` before planning or executing tasks. Paths are under `d:\MMbroliers\.core\` (not legacy Layer-Brolier paths).

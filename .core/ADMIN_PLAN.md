# Broiler Wholesale — Implementation Plan

*Master tracker for building the app from `MM_Poultry_Documentation.md`, architecture aligned with Duro_POS.*

## What We Have Done Till Now

1. Migrated `.agents` / `.core` from earlier LedgerDesk / Duro Tracker notes.
2. **[2026-08-09]** Analyzed `D:\POS\Duro_POS` stack, structure, and architecture; rewrote `.core` for Broiler Wholesale.
3. **[2026-08-09]** Implemented Phases 0–5: greenfield `backend/` + `frontend/`, domain APIs, Expo role UIs, tests, compose/Caddy stubs.
4. **[2026-08-09]** IDEA_Updated MVP expand (Phase 6): persist-first billing, vehicles, ops dashboard, credit limit.

## Reference: Duro_POS analysis (summary)

| Area | Finding |
|------|---------|
| Backend layout | `app/{auth,cli,core,db,models,schemas,routers,services}` |
| Frontend layout | `src/{api,auth,components,navigation,screens,store,services,types}` + printer services |
| Tenancy | `public` + `tenant_<slug>`; provision+stamp |
| Hardware | BLE scale helper + thermal/share print path |

---

## Phase 0 — Scaffold (Duro_POS-shaped empty product)

- **Status:** Done
- **Flow & Options:**
  - [x] Create `backend/` + `frontend/` skeletons (FastAPI + Expo).
  - [x] Compose/Caddy stubs; `.env.example`; health route.
  - [x] Platform tables + tenant provision+stamp; seed users.
  - [x] Auth login + JWT + role guards (ADMIN / DELIVERY / RETAILER / SUPER_ADMIN).

## Phase 1 — Retailers & Orders

- **Status:** Done
- **Flow & Options:**
  - [x] Admin CRUD retailers (opening balance, phone, address).
  - [x] Retailer login places **daily order (kg)**.
  - [x] Admin dashboard: today's orders list + totals.

## Phase 2 — Farm Load & Delivery Run

- **Status:** Done
- **Flow & Options:**
  - [x] Farm load entry (vehicle, driver, loaded weight).
  - [x] Build delivery run from open orders / sequence.
  - [x] Delivery staff app: stop list for active run.

## Phase 3 — Bluetooth Weigh + Thermal Bill

- **Status:** Done (billing order updated in Phase 6)
- **Flow & Options:**
  - [x] BLE/simulated scale → `delivered_weight_kg` on stop.
  - [x] Rate × weight → bill preview.
  - [x] Persist bill first, then print, then update print status (IDEA §17).
  - [x] Update retailer ledger / outstanding.

## Phase 4 — Ledger, Reports, Weight Loss, WhatsApp

- **Status:** Done
- **Flow & Options:**
  - [x] Retailer ledger: deliveries, payments, outstanding.
  - [x] Standalone payment capture (Cash/UPI).
  - [x] Trip weight loss: loaded vs delivered.
  - [x] Daily / weekly / monthly reports (+ PDF).
  - [x] WhatsApp bill sharing from device.

## Phase 5 — Hardening

- **Status:** Done
- **Flow & Options:**
  - [x] Cursor pagination on retailers; error contract tests.
  - [x] Seed demo org + smoke script `backend/scripts/smoke_flow.py`.
  - [x] Compose/Caddy stubs.
  - [x] `.core` checklist sync.

## Phase 6 — IDEA_Updated MVP expand (2026-08-09)

- **Status:** Core done
- **Flow & Options:**
  - [x] Persist-first bill + `checkout_id` + print-status PATCH
  - [x] Credit limit check on bill commit
  - [x] Vehicles CRUD + farm_load.vehicle_id
  - [x] Retailer extras fields
  - [x] Bird counts on weigh / load
  - [x] Ops dashboard API + admin UI metrics
  - [x] Org settings loss thresholds (defaults)
  - [ ] Full retailer form UI for new fields
  - [ ] Expenses / returns / offline / GPS (later IDEA phases)

## Future (proposal — out of v1 scope)

GPS tracking, route optimization, multi-branch, multi-farm management, Tamil/English i18n, SaaS plans, AI/forecasting.

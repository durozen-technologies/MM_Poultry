# Broiler Wholesale — Test Credentials

Seeded via `backend/seed.py` after `uv run python migrate.py`. Tenant users must pass `organization_slug: "demo"` on login (except superadmin).

| Role | Username | Password | Notes |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin` | `password123` | Platform owner; provisions wholesaler orgs. |
| **Wholesaler Admin** | `admin` | `password123` | Tenant admin for demo org (`organization_slug=demo`). |
| **Delivery Staff** | `delivery1` | `password123` | Runs delivery + BLE weigh + print. |
| **Retailer** | `retailer1` | `password123` | Places daily kg orders; views ledger. |

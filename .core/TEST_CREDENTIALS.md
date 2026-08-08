# Broiler Wholesale — Test Credentials (planned)

Credentials will be injected via backend seed once scaffolding lands. Placeholder roles aligned with the new product (not Duro Tracker gas-agency roles).

| Role | Username | Password | Notes |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin` | `password123` | Platform owner; provisions wholesaler orgs. |
| **Wholesaler Admin** | `admin` | `password123` | Tenant admin for demo wholesaler org. |
| **Delivery Staff** | `delivery1` | `password123` | Runs delivery + BLE weigh + print. |
| **Retailer** | `retailer1` | `password123` | Places daily kg orders; views ledger. |

> Seeded via `backend/seed.py`. Tenant users should pass `organization_slug: "demo"` on login (except superadmin).

# MM Poultry (Broiler Wholesale Management App)

## 1. Product Vision
MM Poultry is a robust, multi-tenant B2B application tailored for poultry wholesale management. Designed primarily as a mobile-first application (Android) with supporting web interfaces for back-office administration, the system streamlines the complex logistics of poultry wholesale—from farm loading to retailer delivery, precise weight measurement via BLE scales, billing, and ledger management.

## 2. Core Architecture
The platform is built on a multi-tenant, schema-per-tenant architecture (PostgreSQL) patterned on Duro_POS, ensuring strict data isolation and scalable performance.

- **Backend (API)**: Python (FastAPI), SQLAlchemy (Async), Alembic for schema migrations, `uv` for dependency management.
- **Frontend (Mobile App)**: React Native (Expo 54), TypeScript, Zustand (State Management), NativeWind (Styling).
- **Database**: PostgreSQL (schema-per-tenant strategy).
- **Hardware Integration**: Bluetooth Low Energy (BLE) weighing scale integration, ESC/POS Bluetooth Thermal Printing.

## 3. Key Actors & Capabilities

### Super Admin (Platform Owner)
- **Tenant Provisioning**: Registers new wholesale organizations (tenants).
- **Tenant Management**: Full CRUD capabilities over Organizations and their initial Tenant Admins. 

### Tenant Admin (Wholesaler)
- **Retailer Management**: Manage customer (retailer) profiles, route mapping, pricing rates, credit limits, and outstanding balances.
- **Order Management**: Consolidate daily orders from retailers.
- **Farm & Load Management**: Track farms, configure loading tasks, and manage trip weight losses.
- **Delivery & Billing**: Dispatch delivery runs. Process on-site deliveries using BLE scales for exact weights, generate instant thermal receipts, and commit transactions to the ledger.
- **Reporting & Ledger**: Access operational dashboards, track payments (cash/UPI), and view comprehensive daily reports.

## 4. Key Workflows

1. **Daily Order Collection**: Retailers' daily orders are captured and aggregated.
2. **Farm Loading**: Wholesaler records the total bird weight loaded at the farm.
3. **Delivery Run**: Delivery personnel travel the route to fulfill orders.
4. **BLE Weighing & Billing**: At the retailer, crates are weighed directly via Bluetooth scales. The system calculates the exact price based on the daily rate.
5. **Receipt Printing**: A physical receipt is instantly printed via a Bluetooth thermal printer and committed to the retailer's ledger.
6. **Trip Settlement**: The difference between the total farm loaded weight and the sum of delivered weights is calculated as the `trip weight loss`.

## 5. Deployment & CI/CD
- **Edge Layer**: Caddy reverse proxy handling TLS and rate-limiting.
- **CI/CD**: GitHub Actions for automated linting, testing, and APK builds.
- **Infrastructure**: Dockerized deployment stack.

## 6. Running the Application Locally

### Database & Backend
Ensure PostgreSQL is running and you have `uv` installed.
```bash
cd backend
uv sync
python manage.py setup
python manage.py createsuperadmin --username admin --password <your_password>
uv run uvicorn app.main:app --reload --port 8000
```

### Frontend
Ensure you have `bun` installed (per workspace rules).
```bash
cd frontend
bun install
bun run web
```

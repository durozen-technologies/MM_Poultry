# Data Models & Core Functions

## Data Models Changes Log
*Note: Each time the data models change, append the change in this section with a timestamp. NEVER overwrite historical models.*

### [2026-07-21] Initial LedgerDesk Models Tracked

## Database Operations
Single-tenant PostgreSQL schema (`public`).

### Module Data Models
Below is the list of models tracked in the LedgerDesk system:

**User Model (`users`)**
- Represents authentication credentials for the app.
- Fields: `id`, `username`, `password_hash`, `is_active`, `last_login_at`.

**Party Model (`parties`)**
- Tracks Customers and Suppliers.
- Fields: `id`, `type` (Enum: CUSTOMER, SUPPLIER), `name`, `mobile`, `address`, `opening_balance` (Numeric), `current_balance` (Numeric).
- Logic: `current_balance` represents what is owed. For customers, positive means they owe us. For suppliers, positive means we owe them.

**Purchase Model (`purchases`)**
- Tracks poultry purchases from suppliers.
- Fields: `id`, `party_id` (Supplier), `date`, `vehicle_number`, `driver_name`, `total_boxes`, `birds_per_box`, `expected_birds`, `adjustment`, `actual_birds`, `weighbridge_weight`, `net_weight`, `average_weight`, `purchase_rate`, `purchase_amount`, `cash_payment`, `upi_payment`, `balance_amount`, `remarks`.
- Logic: Automatically adjusts the `current_balance` of the supplier party based on `balance_amount`.

**Sale Model (`sales`)**
- Tracks poultry sales to customers.
- Fields: `id`, `party_id` (Customer), `date`, `vehicle_number`, `weight`, `weight_rate`, `weight_amount`, `boxes`, `box_rate`, `box_amount`, `total_invoice_amount`, `cash_payment`, `upi_payment`, `balance_amount`.
- Logic: Automatically adjusts the `current_balance` of the customer party based on `balance_amount`.

**Expense Category Model (`expense_categories`)**
- Configurable list of expense types (Fuel, Salary, etc.).
- Fields: `id`, `name`.

**Expense Model (`expenses`)**
- Tracks daily operational expenses.
- Fields: `id`, `category_id`, `date`, `description`, `cash_amount`, `upi_amount`, `total_amount`, `remarks`.

**Payment Transaction Model (`payment_transactions`)**
- Simple log of standalone money collection or payout that adjusts a Party's balance (not tied directly to a single bill during creation).
- Fields: `id`, `party_id`, `date`, `cash_amount`, `upi_amount`, `total_amount`, `type` (Enum: RECEIVED, PAID).
- Logic: Adjusts the `current_balance` on the Party immediately.

### [2026-08-09 00:10:00] Broiler Wholesale domain models (proposal + Duro_POS patterns)

LedgerDesk party/purchase/sale models above are **historical**. Active product models follow the proposal workflow and Duro_POS tenancy/retailer/billing patterns.

## Database Operations (current)

- PostgreSQL; platform tables in `public`; operational tables in `tenant_<slug>`.
- Business dates and “today” use IST.
- Money: `Numeric(10, 2)` (or org policy). Weight: `Numeric` kg to 3 decimal places.
- IDs: UUID (prefer uuid7 like Duro_POS).

### Platform (`public`)

**Organization (`organizations`)**
- Wholesaler tenant registry.
- Fields: `id`, `name`, `slug`, `schema_name`, `is_active`, timestamps.

**User Auth Index (`user_auth_index`)**
- Login router across tenants.
- Fields: `username_lower`, `organization_id`, `schema_name`, `user_id`.

**Permission (`permissions`)**
- Global static permission catalog for RBAC.

**Super-admin User (`users` in public)**
- Platform owners only (`organization_id` null).

### Tenant operational models

**User (`users`)**
- Wholesaler admin, delivery staff, and retailer-linked logins.
- Fields: `id`, `username`, `password_hash`, `role` (ADMIN | DELIVERY | RETAILER), `retailer_id` (nullable FK), `is_active`, `perm_version`, `last_login_at`.

**Retailer (`retailers`)** — patterned on Duro_POS
- Chicken shop customers of the wholesaler.
- Fields: `id`, `name`, `shop_name`, `phone`, `alternate_phone`, `address`, `notes`, `is_active`, `opening_balance`, `credit_balance` (outstanding; positive = retailer owes wholesaler), timestamps.

**Retailer Daily Order (`retailer_daily_orders`)** — proposal core
- Retailer places daily chicken requirement in kg.
- Fields: `id`, `retailer_id`, `order_date` (IST date), `requested_kg`, `notes`, `status` (PLACED | ACKNOWLEDGED | PARTIAL | FULFILLED | CANCELLED), `created_by_user_id`, timestamps.
- Unique: `(retailer_id, order_date)` (one primary order per day; amendments via status/notes or versioning later).

**Farm (`farms`)** — light master; multi-farm is a future enhancement
- Fields: `id`, `name`, `location`, `contact_phone`, `is_active`.

**Farm Load (`farm_loads`)** — proposal step 4
- Birds loaded from farm for a delivery day/trip.
- Fields: `id`, `load_date`, `farm_id` (nullable), `vehicle_number`, `driver_name`, `driver_user_id` (nullable), `loaded_weight_kg`, `bird_count` (nullable), `remarks`, `status` (OPEN | IN_TRANSIT | CLOSED), timestamps.

**Delivery Run (`delivery_runs`)**
- One trip that consumes a farm load and serves many retailers.
- Fields: `id`, `farm_load_id`, `run_date`, `status` (PLANNED | IN_PROGRESS | COMPLETED | CANCELLED), `started_at`, `completed_at`.

**Delivery Stop (`delivery_stops`)**
- Per-retailer stop on a run.
- Fields: `id`, `delivery_run_id`, `retailer_id`, `daily_order_id` (nullable), `sequence`, `ordered_kg`, `delivered_weight_kg` (from Bluetooth scale), `rate_per_kg`, `gross_amount`, `status` (PENDING | WEIGHED | BILLED | SKIPPED), `weighed_at`, `scale_device_id` (nullable string).

**Delivery Bill / Receipt (`delivery_bills`)**
- Immutable commercial document after weigh + print/commit.
- Fields: `id`, `bill_number` (e.g. `DEL-YYYY-000001`), `delivery_stop_id`, `retailer_id`, `bill_date`, `weight_kg`, `rate_per_kg`, `total_amount`, `cash_payment`, `upi_payment`, `balance_amount`, `print_status`, `whatsapp_shared_at` (nullable), timestamps.
- Logic: increases retailer `credit_balance` by `balance_amount`; print-before-commit when device present.

**Payment (`payments`)**
- Standalone or bill-linked collections.
- Fields: `id`, `retailer_id`, `delivery_bill_id` (nullable), `date`, `cash_amount`, `upi_amount`, `total_amount`, `type` (RECEIVED | ADJUSTMENT), `notes`.
- Logic: reduces retailer `credit_balance` on RECEIVED.

**Trip Weight Loss (`trip_weight_losses`)** — proposal analytics
- Per farm load / delivery run: `loaded_weight_kg - sum(delivered_weight_kg)`.
- Fields: `id`, `farm_load_id`, `delivery_run_id`, `loaded_kg`, `delivered_kg`, `loss_kg`, `loss_pct`, `computed_at`.
- Note: Distinct from Duro_POS overnight inventory grams/day loss; this product’s primary loss is **trip shrink**. Optional later: inventory overnight loss as in Duro_POS `weight_loss.py`.

**Rate Card (`retailer_item_rates`)** — optional v1 simplicity: single broiler kg rate
- Fields: `id`, `retailer_id` (nullable = default org rate), `rate_per_kg`, `effective_from`, `effective_to` (nullable).

### Core calculations

1. **Stop amount:** `delivered_weight_kg * rate_per_kg`.
2. **Bill balance:** `total_amount - cash_payment - upi_payment`.
3. **Trip loss:** `farm_loads.loaded_weight_kg - Σ delivery_stops.delivered_weight_kg` (WEIGHED/BILLED only).
4. **Retailer outstanding:** `opening_balance + Σ bill balances - Σ payments` (maintained as `credit_balance`).

### [2026-08-09 01:00:00] IDEA MVP expand models

**Vehicle (`vehicles`)**
- `id`, `number` (unique), `capacity_kg`, `driver_name`, `is_active`.

**OrgSettings (`org_settings`)** � single-row tenant defaults
- `weight_loss_warn_pct` (default 2), `weight_loss_alert_pct` (default 5), `enforce_credit_limit`.

**Retailer extras**
- `owner_name`, `whatsapp`, `area`, `route_name`, `category`, `credit_limit`, `preferred_delivery_time`.

**FarmLoad**
- `vehicle_id` (FK vehicles, nullable) alongside `vehicle_number`.

**DeliveryStop**
- `delivered_bird_count` (nullable).

**DeliveryBill**
- `checkout_id` (unique) � client-generated or server UUID; persist-first with `print_status=PENDING` allowed; update via PATCH.

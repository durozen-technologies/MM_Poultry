# Ideas Log

*This document serves as the chronological scribe for all ideas, feature requests, and conceptual thoughts for LedgerDesk.*

## [2026-07-21] Initial Project Idea

Design and develop a modern, mobile-first poultry business management application named **LedgerDesk**. The application is intended for poultry wholesalers, farms, and chicken shops to digitally manage their entire business from a single platform. The focus should be on **speed, simplicity, and real-time business tracking**, replacing traditional paper registers.

The application should support both **Android mobile devices** (primary platform) and a **responsive desktop/web interface** for office use. Both platforms must share the same backend and database so that all information remains synchronized in real time.

**Key Features Needed:**
1. **Dashboard**: Complete overview with total sales, purchases, expenses, profit, outstanding balances, and total birds/weights.
2. **Party Management**: Create Customers and Suppliers. Track opening balance, outstanding due, bills, and payments (Cash/UPI).
3. **Purchase Module**: Record poultry purchases. Auto-calculate expected birds, net weight, average weight, and total amount.
4. **Sales Module**: Record sales to customers based on weight and boxes. Auto-calculate totals and balances.
5. **Expense Management**: Configurable expense categories (Fuel, Salary, Feed, etc.).
6. **Reports & PDF Generation**: Purchase, Sales, Expense, and Party Ledger reports with PDF generation.

The app must be simple, reliable, and prioritize fast data entry.

- [2026-07-27] generate a unique bill for purchase as PUR-YYYY-000001 and sale as SAL-YYYY-000001, reset every new year.

### [2026-08-01 10:18:00] Idea: Add Nickname field to Party
**Description**: User requested to add a 'Nickname' field under Name/Company Name when adding a new party.


[2026-08-05 10:41:50] Add full non-editable preview of bill entries when tapping a bill card on the Bills screen.

[2026-08-05 10:48:32] Update BillPreviewModal layout to mirror the exact UI table grid of BillEntryScreen but in a read-only state.

[2026-08-05 10:58:32] Add bottom Summary block and top Remaining Weight field to BillPreviewModal to fully mirror BillEntryScreen features.

[2026-08-05 12:14:07] Improve UI for SearchDropdown components (Party, Item, Driver) to use absolute positioning, removing vertical expansion of rows and mimicking Excel's floating dropdown layout.

[2026-08-05 12:19:42] Adjust dropdown width to exactly match the text field width. Adjust ScrollView zIndex so that dropdowns render above the TotalsStrip.

[2026-08-05 12:30:51] Style dropdown text inputs so they have no internal borders or background, allowing them to perfectly blend into the grid cell's own styling, like Excel.

[2026-08-05 13:02:42] Handle Web ScrollView clipping of absolute positioned dropdowns by dynamically expanding paddingBottom of the ScrollView content when a dropdown opens.


[2026-08-05 14:21:00] Collection page uses party balance only (no FIFO). Opening balance CR/DR. Tabs To Pay / To Receive. Pay modal Cash+UPI+Bank.


[2026-08-05 15:34:00] Bill preview: Edit and Delete from Bills menu. Edit opens bill entry copy; delete with confirmation. No edit-time restrictions.


[2026-08-05 15:46:00] Bill list opens Bill Entry as preview (not separate preview page). Edit + Delete in header.

[2026-08-05 16:01:36] Rename 'Empty Bird' to 'Weight Loss' across the app.

[2026-08-05 16:05:23] Reorganize Bill Entry Summary: Move Remaining Weight below Profit/Loss on left side, move Cash Received above UPI on right side.

[2026-08-05 16:27:45] Merged Driver Mobile into the Driver field in the BillEntryScreen to save horizontal space.

[2026-08-05 16:37:24] Standardized all table fields to a uniform height of 36px (h-9).

[2026-08-05 16:45:12] Replaced the category tap buttons with a searchable Category dropdown to conserve vertical space and streamline expense entry.

### [2026-08-09 00:10:00] Pivot: Broiler Wholesale Management App from Duro_POS

**Source:** `Broiler_Wholesale_App_Proposal.md` + analysis of `D:\POS\Duro_POS`.

Build a mobile app for broiler wholesalers who buy from farms and supply retail chicken shops daily. Digitalize order booking → farm load → Bluetooth delivery weigh → thermal receipt → retailer ledger → weight-loss analysis → WhatsApp bill share.

**Adopt Duro_POS tech/architecture:** FastAPI + SQLAlchemy async + schema-per-tenant Postgres + Expo 54 + Zustand + NativeWind + BLE + ESC/POS + Caddy; dual Alembic; print-before-commit; structured errors; cursor pagination.

**Domain shift away from LedgerDesk party/purchase/sale core** toward: retailer daily kg orders, farm loads, delivery runs/stops, trip shrink (loaded − delivered), retailer self-service.

**Prepared by framing:** Durozen Technologies Pvt. Ltd. customer proposal.

### [2026-08-09 00:35:00] IST + DD/MM/YYYY + datepicker
Strict Indian Standard Time for DB/business dates; API/UI date wire format DD/MM/YYYY; all date entry via native datepicker only.

### [2026-08-09 01:00:00] Source: Broiler_Wholesale_App_IDEA_Updated.md
Expanded blueprint beyond short proposal. Implementing IDEA MVP-1 slice: ops dashboard, vehicles master, richer retailers, bird counts, persist-first billing + checkout_id, credit limit, loss thresholds. Defer GPS/offline/SaaS/AI.

### [2026-08-18 16:01:39] Explicit Separation of Organization and Admin Creation
- **Thought**: The user explicitly requested to ensure that an admin user is *not* created automatically after an organization is created, and must be created manually. Although the system currently adheres to this separation, it is recorded here as a core invariant/design principle moving forward.

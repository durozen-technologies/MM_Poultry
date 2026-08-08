# BROILER WHOLESALE MANAGEMENT APP
## Complete Product IDEA, Feature Map & Implementation Approach

> **Document purpose:** This is the expanded product-idea and implementation-planning document for the Broiler Wholesale Management App. It combines the original customer proposal with the current Duro_POS-aligned architecture and additional product ideas, workflows, controls, automation opportunities, hardware integration approaches, analytics, and future expansion paths.
>
> **Status:** Product discovery + solution blueprint  
> **Last updated:** 2026-08-09  
> **Company:** Durozen Technologies Pvt. Ltd.

---

# 1. Product Vision

Build a **mobile-first operating system for broiler wholesalers** that connects:

**Farm → Loading → Vehicle → Delivery Route → Retailer → Weighing → Billing → Payment → Ledger → Weight Loss → Profitability → Reports**

The core objective is not simply to create a billing application. The product should become the wholesaler's **daily operating control system**.

The system should answer, at any moment:

- What did each retailer order?
- How much chicken is required today?
- How much was loaded from each farm?
- Which vehicle and driver are carrying it?
- Which retailers are on today's route?
- How much was actually delivered to each retailer?
- What was the loaded-vs-delivered weight difference?
- What amount was billed?
- How much has the retailer paid?
- What is outstanding?
- How much did the wholesaler buy?
- What is the actual margin?
- Where is abnormal weight loss happening?
- Which retailer, driver, route, farm, or vehicle is creating a recurring problem?

The original proposal already defines the core workflow of retailer orders, farm loading, Bluetooth weighing, thermal printing, billing, ledger, and weight-loss analysis. This document expands that into a complete product strategy. 

---

# 2. Original Core Workflow

The baseline workflow is:

1. Retailer receives secure login.
2. Retailer places daily requirement in kilograms.
3. Wholesaler sees all orders in one dashboard.
4. Wholesaler loads birds from farm and records loading weight.
5. Delivery staff reaches retailers.
6. Bluetooth weighing scale sends actual delivery weight.
7. Receipt is printed.
8. Retailer sees delivery, bill, payments and outstanding.
9. System calculates loaded weight, delivered weight and weight loss.

This remains the **MVP backbone**.

---

# 3. Recommended Product Modules

## 3.1 Super Admin / SaaS Control Plane

For Durozen's own platform operation.

### Features

- Create wholesaler organization
- Create tenant
- Activate/deactivate tenant
- Subscription plan
- Trial period
- Tenant usage statistics
- Tenant user count
- Device count
- Printer count
- Scale count
- API usage
- Storage usage
- Subscription status
- Feature flags
- Tenant support access
- Audit logs
- Platform announcements
- System health
- Backup status
- Migration status

### SaaS plans

Possible plans:

| Plan | Target | Possible Features |
|---|---|---|
| Starter | Small wholesaler | Orders, delivery, billing, ledger |
| Growth | Medium wholesaler | Routes, staff, reports, WhatsApp |
| Professional | Large wholesaler | Multi-branch, advanced analytics, automation |
| Enterprise | Large distributor | Custom integrations, API, SLA, dedicated infrastructure |

---

# 4. Wholesaler Admin Module

## Dashboard

The first screen should immediately answer:

### Today's operational numbers

- Total orders
- Ordered kg
- Loaded kg
- Delivered kg
- Pending kg
- Total sales
- Total collection
- Outstanding
- Weight loss
- Weight loss %
- Number of retailers
- Completed deliveries
- Pending deliveries
- Failed deliveries

### Operational status

- Orders not confirmed
- Farm load not completed
- Vehicle not dispatched
- Deliveries in progress
- Deliveries completed
- Payment pending
- Printer disconnected
- Scale disconnected
- Offline transactions waiting for sync

### Alerts

- Abnormal weight loss
- Retailer overdue
- Retailer order increased sharply
- Retailer order not received
- Farm loading mismatch
- Vehicle capacity exceeded
- Delivery delayed
- Scale disconnected
- Printer disconnected
- Duplicate/failed transaction
- Low cash collection
- Unusual rate change

---

# 5. Retailer Management

## Retailer Master

Fields:

- Retailer name
- Shop name
- Owner name
- Mobile number
- WhatsApp number
- Address
- GPS location
- Area
- Route
- Opening balance
- Credit limit
- Payment terms
- Preferred delivery time
- Active/inactive
- GSTIN, if applicable
- FSSAI details, if applicable
- Notes
- Assigned delivery staff
- Assigned vehicle
- Price category

## Retailer categories

Examples:

- Regular
- Premium
- Cash customer
- Credit customer
- High-volume
- Low-volume
- Wholesale retailer
- Hotel/restaurant
- Institutional buyer

## Retailer-specific pricing

Allow different prices for the same product:

- Base rate
- Retailer rate
- Special rate
- Temporary rate
- Date-specific rate
- Quantity-based rate
- Cash rate
- Credit rate

Every rate change should have:

- Old rate
- New rate
- Effective date
- Changed by
- Reason

---

# 6. Retailer Login

The retailer app should be extremely simple.

## Home

Show:

- Today's order
- Today's delivered kg
- Today's bill
- Amount paid
- Current outstanding
- Next expected delivery
- Last delivery
- Quick reorder

## Order

Retailer can:

- Enter kg
- Increase/decrease quantity
- Select delivery date
- Add notes
- Set preferred delivery time
- Repeat yesterday's order
- Repeat last week's order
- Cancel before cutoff
- Modify pending order

## History

- Orders
- Deliveries
- Bills
- Payments
- Outstanding
- Receipts
- Ledger statement

## Payment

Possible future integrations:

- UPI payment link
- QR payment
- Payment screenshot upload
- Payment reference
- Online payment gateway
- Payment request

---

# 7. Daily Order Management

This should be one of the strongest modules.

## Order lifecycle

```text
Draft
  ↓
Submitted
  ↓
Confirmed
  ↓
Allocated
  ↓
Loaded
  ↓
Out for Delivery
  ↓
Delivered
  ↓
Billed
  ↓
Paid / Partially Paid / Credit
```

## Order features

- Daily order
- Recurring order
- Standing order
- Cutoff time
- Order modification
- Order cancellation
- Minimum order quantity
- Maximum order quantity
- Order approval
- Order notes
- Priority order
- Emergency order
- Late order
- Order change history

## Smart order suggestions

The app can suggest:

> Yesterday: 80 kg  
> Last 7-day average: 76 kg  
> Same weekday average: 79 kg  
> Suggested order: 78 kg

This should remain advisory rather than automatically changing the retailer's order.

---

# 8. Demand Forecasting

Future AI module.

Use historical:

- Retailer order history
- Day of week
- Festival periods
- Seasonal demand
- Weather
- Local events
- Previous holidays
- Price changes
- Delivery failures
- Retailer growth trend

### Output

- Expected demand tomorrow
- Expected demand next 7 days
- Expected farm requirement
- Expected vehicle requirement
- Expected retailer demand

### Approach

Start with:

1. Moving average
2. Weighted moving average
3. Day-of-week model
4. Exponential smoothing
5. Later ML forecasting

Do not begin with complex AI. Build reliable historical data first.

---

# 9. Farm Management

## Farm Master

Fields:

- Farm name
- Supplier/farmer name
- Contact
- Location
- GPS
- FSSAI/license details where relevant
- Payment terms
- Default rate
- Bird type
- Supplier status
- Notes

## Farm purchase/load

Record:

- Date
- Time
- Farm
- Vehicle
- Driver
- Bird count
- Gross weight
- Tare weight
- Net weight
- Average bird weight
- Rate
- Purchase value
- Transport cost
- Other cost
- Loading staff
- Loading notes

## Multiple farms

A single delivery trip may be supplied by:

```text
Farm A → 400 kg
Farm B → 300 kg
Farm C → 250 kg
----------------
Total → 950 kg
```

The system should preserve farm-level traceability.

---

# 10. Bird Count Management

Weight alone is not enough for a poultry-specific system.

Track:

- Loaded bird count
- Delivered bird count
- Returned bird count
- Dead-on-arrival count
- Missing bird count
- Damaged/Rejected count
- Average weight per bird

Possible calculation:

```text
Average Bird Weight
= Net Loaded Weight / Loaded Bird Count
```

Retailer-level:

```text
Delivered Average Bird Weight
= Delivered Weight / Delivered Bird Count
```

This enables better operational analysis.

---

# 11. Vehicle Management

## Vehicle master

- Vehicle number
- Vehicle type
- Capacity
- Driver
- Helper
- Owner
- Insurance expiry
- Permit expiry
- Fitness expiry
- Pollution certificate expiry
- Active/inactive

## Trip

Each trip should have:

- Trip number
- Date
- Vehicle
- Driver
- Helper
- Farm(s)
- Retailer route
- Start time
- Load weight
- Load bird count
- Delivery weight
- Return weight
- Closing time
- Fuel expense
- Other trip expenses

---

# 12. Delivery Run Management

## Delivery run

A run groups multiple retailer deliveries.

Example:

```text
Trip #TR-2026-0012

Vehicle: TN XX XXXX
Driver: Kumar

Farm Load:
950 kg

Stops:
1. Retailer A — 150 kg
2. Retailer B — 200 kg
3. Retailer C — 175 kg
4. Retailer D — 225 kg
5. Retailer E — 180 kg

Expected delivery:
930 kg

Actual delivery:
914 kg

Trip difference:
36 kg
```

---

# 13. Delivery Stop Screen

The delivery staff should have a very fast workflow.

## Screen

```text
Retailer
Address
Phone
Order: 150 kg
Previous delivery: 145 kg

[ CONNECT SCALE ]

Scale:
147.650 kg

Bird Count:
110

[ CONFIRM DELIVERY ]

Payment:
[ Cash ] [ UPI ] [ Credit ]

[ PRINT RECEIPT ]

[ WHATSAPP ]
```

Avoid unnecessary fields during delivery.

---

# 14. Bluetooth Weighing Scale Strategy

The original proposal requires Bluetooth weighing integration.

Android supports BLE through GATT services and characteristics, making BLE a viable architecture when the scale exposes a compatible BLE protocol. citeturn0search2turn0search3

## Important architecture decision

Do not hard-code one scale protocol.

Create:

```text
ScaleProvider
├── BLE Scale
├── Classic Bluetooth Scale
├── USB/OTG Scale
├── Network Scale
└── Manual Entry
```

## Scale configuration

Each scale can store:

- Device name
- MAC/device identifier
- Protocol
- Service UUID
- Characteristic UUID
- Weight format
- Unit
- Decimal precision
- Stability flag
- Sign/negative handling
- Connection timeout

## Weight validation

Do not accept every BLE message as final weight.

Use:

```text
Raw reading
    ↓
Parse
    ↓
Validate
    ↓
Stable reading detection
    ↓
Minimum/maximum range check
    ↓
User confirmation
    ↓
Delivery weight
```

## Stable weight

Possible rule:

```text
Reading must remain within ±X grams
for Y consecutive readings
```

Make X and Y configurable per scale.

---

# 15. Manual Scale Fallback

The app must continue working if the scale fails.

Options:

### Mode A — Manual entry

Staff enters:

`147.650 kg`

### Mode B — Photo evidence

Take photo of scale display.

Store:

- Photo
- Timestamp
- Delivery ID
- User
- Entered weight

### Mode C — Supervisor approval

Manual weight above a configurable threshold requires supervisor confirmation.

This prevents hardware failure from stopping the business.

---

# 16. Thermal Printer Strategy

Support ESC/POS printers.

Possible receipt:

```text
--------------------------------
      WHOLESALER NAME
       PHONE / ADDRESS
--------------------------------
Bill No: BW-000123
Date: 09-08-2026
Retailer: ABC Chicken Shop

Ordered       150.000 kg
Delivered     147.650 kg
Bird Count    110

Rate          ₹XXX/kg
Amount        ₹XX,XXX

Paid          ₹X,XXX
Balance       ₹X,XXX
--------------------------------
Weight recorded electronically
Thank you
--------------------------------
```

## Printer fallback

If printer fails:

- Save print job
- Retry
- Show reprint
- Allow PDF receipt
- Allow WhatsApp receipt
- Record printer error
- Never lose the bill because printing failed

---

# 17. Critical Billing Architecture

The system should **not depend on printer success for financial persistence**.

Recommended architecture:

```text
Create delivery transaction
        ↓
Persist bill + delivery + ledger atomically
        ↓
Mark receipt as PRINT_PENDING
        ↓
Print
        ↓
PRINTED / PRINT_FAILED
```

If printing fails:

```text
Bill remains saved
+
Inventory remains correct
+
Receipt can be reprinted
```

This is safer than making financial persistence dependent on hardware.

## Idempotency

Every checkout should have a unique:

```text
checkout_id
```

Retrying the same request must not create:

- duplicate bill
- duplicate ledger entry
- duplicate stock deduction
- duplicate payment

---

# 18. Ledger

The retailer ledger should support:

- Opening balance
- Sales bills
- Payments
- Credit notes
- Debit notes
- Adjustments
- Returns
- Closing balance

Example:

```text
Opening Balance       ₹10,000
+ Today's Bill         ₹8,500
- Payment              ₹5,000
------------------------------
Closing Outstanding   ₹13,500
```

## Payment methods

- Cash
- UPI
- Bank transfer
- Cheque
- Credit adjustment
- Other

## Split payment

Example:

```text
Bill: ₹10,000

Cash: ₹3,000
UPI:  ₹4,000
Credit: ₹3,000
```

---

# 19. Credit Control

Each retailer can have:

- Credit limit
- Current outstanding
- Available credit
- Overdue amount
- Payment terms
- Days overdue

Alerts:

```text
80% credit used
90% credit used
100% credit exceeded
Payment overdue
```

Optional policy:

```text
Allow delivery
Allow with warning
Require admin approval
Block credit delivery
```

---

# 20. Weight Loss Engine

The original proposal identifies:

```text
Weight Loss = Loaded Weight - Delivered Weight
```

Expand this into multiple levels.

## Trip loss

```text
Trip Loss
= Total Loaded Weight
- Total Delivered Weight
- Valid Return Weight
```

## Percentage

```text
Loss %
= Loss / Loaded Weight × 100
```

## Bird-level analysis

```text
Loaded birds
Delivered birds
Missing birds
Average loaded weight
Average delivered weight
```

## Retailer-level difference

Compare:

```text
Expected allocation
vs
Actual delivery
```

---

# 21. Weight Loss Classification

Do not treat every difference as the same problem.

Possible classifications:

- Normal transit loss
- Water/moisture loss
- Handling loss
- Dead bird
- Rejected bird
- Loading error
- Weighing error
- Retailer shortage
- Return
- Unknown

Allow the user to classify a discrepancy.

---

# 22. Weight Loss Thresholds

Configure thresholds:

```text
0–1%      Normal
1–2%      Watch
2–3%      Warning
>3%       Critical
```

These are example configuration values, not universal poultry standards.

The wholesaler should be able to change them.

---

# 23. Weight Loss Investigation

When abnormal loss occurs:

```text
Abnormal loss detected
        ↓
Open investigation
        ↓
Select trip
        ↓
Review farm load
        ↓
Review vehicle
        ↓
Review route
        ↓
Review delivery sequence
        ↓
Review individual weights
        ↓
Add explanation
        ↓
Supervisor closes investigation
```

Store the complete audit trail.

---

# 24. Inventory Concept

If the business also manages other poultry supplies, support:

- Live birds
- Processed chicken
- Feed
- Packaging
- Crates
- Ice
- Other consumables

For live-bird inventory:

```text
Stock = additions - deliveries - losses - returns + adjustments
```

Do not rely only on a manually editable balance.

Use transaction history as the source of truth.

---

# 25. Crate / Box Management

Very useful poultry-specific feature.

Track:

- Crates sent
- Crates received
- Crates with retailer
- Damaged crates
- Missing crates
- Deposit
- Return date

Example:

```text
Retailer A

Crates issued: 50
Returned:      46
Pending:        4
```

---

# 26. Delivery Packaging

If business uses:

- Crates
- Boxes
- Bags
- Ice boxes

Track packaging separately from chicken weight.

---

# 27. Returns Management

Support:

- Full return
- Partial return
- Rejected birds
- Damaged stock
- Quality rejection
- Wrong delivery
- Excess delivery

Return should automatically affect:

- Inventory
- Retailer ledger
- Sales bill
- Weight-loss calculation
- Reports

---

# 28. Rate Management

## Rate types

- Farm purchase rate
- Retailer selling rate
- Default wholesale rate
- Special retailer rate
- Area rate
- Route rate
- Date rate
- Emergency rate

## Rate history

Never overwrite historical rates.

Every bill should retain its exact rate at the time of billing.

---

# 29. Profitability

Calculate profit at multiple levels.

## Bill profit

```text
Selling Value
- Allocated Purchase Cost
- Delivery Cost
- Other Direct Cost
= Gross Profit
```

## Trip profit

```text
Total Sales
- Farm Cost
- Transport
- Labour
- Loss Cost
- Other Trip Costs
= Trip Profit
```

## Retailer profitability

Show:

- Sales
- Gross margin
- Payment behavior
- Delivery cost estimate
- Average order
- Average margin
- Outstanding

This identifies profitable and unprofitable retailers.

---

# 30. Expense Management

Track:

- Fuel
- Driver salary
- Helper salary
- Vehicle repair
- Ice
- Electricity
- Loading labour
- Unloading labour
- Packaging
- Rent
- Phone
- Maintenance
- Other expenses

Allow:

- Daily expense
- Trip expense
- Branch expense
- Category
- Attachment
- Approval

---

# 31. Route Management

Basic approach:

```text
Retailers
  ↓
Assign area
  ↓
Assign route
  ↓
Assign vehicle
  ↓
Assign driver
```

Advanced approach:

- GPS coordinates
- Stop sequence
- Delivery time windows
- Vehicle capacity
- Driver work hours
- Traffic
- Priority retailers

Google's current Route Optimization API can optimize vehicle routes using objectives and constraints such as travel efficiency, time windows, vehicle capacity, driver work hours and load balancing. citeturn1search0turn1search1

For a smaller deployment, simple waypoint optimization can be enough before moving to full fleet optimization. Google's Routes API supports waypoint-order optimization. citeturn1search6

---

# 32. GPS Tracking

Future feature.

Driver can share:

- Current location
- Trip status
- Route progress
- Last known location
- Delivery ETA

Retailer sees:

```text
Driver is 18 minutes away
```

Do not continuously track location unless necessary. Use configurable tracking intervals.

---

# 33. Proof of Delivery

At delivery completion, capture:

- Weight
- Bird count
- Retailer confirmation
- Signature
- Photo
- GPS
- Timestamp
- Delivery staff
- Payment information

Possible confirmation:

```text
[ ACCEPT DELIVERY ]

Retailer:
Name / OTP / Signature
```

---

# 34. OTP Delivery Confirmation

Optional.

Flow:

```text
Delivery completed
      ↓
OTP sent to retailer
      ↓
Retailer provides OTP
      ↓
Delivery confirmed
```

Useful for disputed deliveries.

---

# 35. WhatsApp Integration

Possible use cases:

- Daily order reminder
- Order confirmation
- Delivery notification
- Bill
- Payment reminder
- Outstanding statement
- Receipt
- Route ETA
- Promotional message

The architecture should keep WhatsApp behind a service abstraction:

```text
NotificationService
├── WhatsApp
├── SMS
├── Push Notification
└── Email
```

This avoids coupling business logic to one messaging provider.

---

# 36. Payment Automation

Possible future features:

- UPI QR
- Payment link
- UPI intent
- Payment gateway
- Automatic payment reconciliation
- Payment webhook
- Payment reference matching

Do not mark a payment as successful only because the user uploaded a screenshot.

Use verified payment status where possible.

---

# 37. Reports

## Daily

- Orders
- Loading
- Deliveries
- Sales
- Collections
- Outstanding
- Weight loss
- Expenses
- Profit

## Weekly

- Retailer sales
- Retailer collections
- Farm purchases
- Trip performance
- Driver performance
- Weight-loss trend

## Monthly

- Revenue
- Cost
- Gross profit
- Outstanding
- Retailer growth
- Farm comparison
- Vehicle performance

---

# 38. Advanced Reports

### Retailer report

```text
Retailer
Orders
Delivered KG
Sales
Paid
Outstanding
Average Rate
Average KG
```

### Farm report

```text
Farm
Loaded KG
Bird Count
Purchase Cost
Average Rate
Average Bird Weight
```

### Vehicle report

```text
Vehicle
Trips
Loaded KG
Delivered KG
Loss KG
Loss %
Fuel
Trip Cost
```

### Driver report

```text
Driver
Trips
Deliveries
On-time %
Collection
Weight discrepancy
```

---

# 39. Operational Dashboard

Recommended main dashboard sections:

```text
TODAY

Orders       42
Loaded       2,850 kg
Delivered    2,620 kg
Loss           80 kg
Sales       ₹X,XX,XXX
Collected   ₹X,XX,XXX
Outstanding ₹X,XX,XXX

--------------------------------

DELIVERY STATUS

Pending       7
In Progress   3
Completed    32

--------------------------------

ALERTS

3 overdue retailers
2 high-loss trips
1 printer offline
```

---

# 40. Offline-First Approach

This is critical because delivery areas may have weak internet.

## Mobile should support

- Login session
- Today's route
- Retailer data
- Orders
- Delivery creation
- Weight capture
- Receipt printing
- Payment capture
- Local queue

## Sync

```text
Local transaction
       ↓
Outbox
       ↓
Internet available
       ↓
API sync
       ↓
Server confirmation
       ↓
Mark synced
```

## Conflict handling

Use:

- UUID transaction IDs
- Idempotency keys
- Server timestamps
- Version numbers
- Conflict status

Never create a second bill just because a sync request was retried.

---

# 41. Sync Architecture

Recommended:

```text
React Native
   ↓
Local SQLite
   ↓
Repository Layer
   ↓
Sync Engine
   ↓
FastAPI
   ↓
PostgreSQL
```

Remote data:

```text
PostgreSQL = source of truth
```

Local data:

```text
Offline operational cache
```

---

# 42. Multi-Tenant Architecture

The current architecture uses:

```text
public
  ├── organizations
  ├── super-admin users
  └── platform controls

tenant_<slug>
  ├── retailers
  ├── users
  ├── orders
  ├── farm loads
  ├── delivery runs
  ├── bills
  ├── payments
  └── reports
```

This matches the current architecture document's Duro_POS-aligned schema-per-tenant approach.

---

# 43. Recommended Domain Model

Core entities:

```text
Organization
User
Role
Permission

Retailer
RetailerAddress
RetailerPrice
RetailerCreditLimit

Farm
FarmRate
FarmPurchase
FarmLoad

Vehicle
Driver
DeliveryRoute
DeliveryRun
DeliveryStop

Order
OrderItem

Delivery
DeliveryItem
DeliveryWeight
DeliveryEvidence

Bill
BillItem
Payment
LedgerEntry

InventoryMovement
Return
LossAdjustment

Expense

ScaleDevice
PrinterDevice

Notification
WhatsAppMessage

AuditLog
SyncEvent
```

---

# 44. Device Management

Each Android device should be registered.

Store:

- Device ID
- User
- Organization
- App version
- OS version
- Last sync
- Scale connected
- Printer connected
- Device status

Admin can:

- Revoke device
- Force logout
- View last sync
- View app version
- Require update

---

# 45. Printer and Scale Pairing

Do not pair devices permanently only through code.

Use:

```text
Settings
  ↓
Hardware
  ↓
Add Scale
  ↓
Scan
  ↓
Select
  ↓
Test
  ↓
Save
```

Same for printers.

---

# 46. Hardware Test Mode

Add a dedicated screen:

```text
Scale
[ Connected ]

Live Weight:
147.650 kg

[ Test Weight Capture ]

Printer
[ Connected ]

[ Test Print ]
```

This dramatically reduces support issues.

---

# 47. Notifications

Types:

- New order
- Order changed
- Delivery started
- Delivery arriving
- Delivery completed
- Bill generated
- Payment received
- Payment overdue
- High weight loss
- Driver delayed
- Device offline
- Sync failed

Notification preferences should be configurable by role.

---

# 48. Audit Log

Every sensitive operation should record:

- User
- Action
- Timestamp
- Device
- IP where appropriate
- Before value
- After value
- Reason

Important actions:

- Rate change
- Bill cancellation
- Payment edit
- Opening balance edit
- Retailer edit
- Delivery edit
- Weight correction
- Stock adjustment
- Credit limit change
- User permission change

---

# 49. Correction Strategy

Never silently overwrite historical financial/weight records.

Prefer:

```text
Original
   ↓
Correction transaction
   ↓
Audit trail
```

Example:

```text
Original weight: 147.650 kg
Correction: +0.500 kg
Reason: Scale reading error
Approved by: Admin
```

---

# 50. Bill Cancellation

A bill should not simply disappear.

Lifecycle:

```text
Issued
Paid / Partial / Credit
Cancelled
Reversed
```

Cancellation requires:

- Reason
- User
- Timestamp
- Approval if configured

Financial effects should be reversed through ledger transactions.

---

# 51. Retailer Statement

Generate downloadable/shareable statement:

```text
Retailer Statement
Period: 01-08-2026 to 09-08-2026

Opening Balance
Sales
Payments
Adjustments
Closing Balance

Total Sales
Total Paid
Outstanding
```

Provide:

- PDF
- WhatsApp
- Print
- Share

---

# 52. Daily Closing

At end of day:

```text
Orders received
Orders fulfilled
Farm load
Total deliveries
Total sales
Cash collected
UPI collected
Credit sales
Outstanding
Returns
Loss
Expenses
Profit estimate
```

Admin can close the day.

After closing:

- restrict edits
- require approval for changes
- maintain audit log

---

# 53. Day Reconciliation

Compare:

```text
Farm loaded
+
Opening stock
-
Retailer deliveries
-
Returns
-
Loss
=
Expected closing stock
```

Then compare with physical closing stock.

Show:

```text
Expected: 320 kg
Physical: 310 kg
Difference: -10 kg
```

---

# 54. Cash Reconciliation

At day end:

```text
Opening Cash
+ Cash Collections
- Expenses
- Bank Deposit
= Expected Cash

Actual Cash
vs
Expected Cash
```

Show variance.

---

# 55. Payment Collection Route

Delivery staff can see:

```text
Retailer A
Outstanding: ₹25,000
Today's Bill: ₹8,500

[ COLLECT PAYMENT ]
```

This turns the delivery route into a collection route.

---

# 56. Collection Prioritization

Rank retailers by:

- Outstanding
- Days overdue
- Credit limit
- Risk
- Delivery route

Example:

```text
HIGH PRIORITY
Retailer A — ₹85,000 overdue 18 days

MEDIUM
Retailer B — ₹42,000 overdue 7 days

NORMAL
Retailer C — ₹12,000 current
```

---

# 57. Customer Credit Risk

Future scoring:

```text
Payment history
+
Average delay
+
Outstanding
+
Credit usage
+
Order consistency
```

Output:

```text
Low Risk
Medium Risk
High Risk
```

Use this as decision support, not automatic credit denial initially.

---

# 58. Smart Alerts

Examples:

### Retailer order anomaly

```text
Retailer normally orders 70–80 kg.
Today's order = 150 kg.
```

### Weight anomaly

```text
Typical trip loss = 1.1%
Today = 3.4%
```

### Payment anomaly

```text
Retailer usually pays daily.
No payment for 5 days.
```

### Farm anomaly

```text
Farm A purchase rate increased 8%.
```

---

# 59. AI Assistant

Future feature:

> "Why was today's profit lower?"

Assistant can summarize:

```text
Today's profit was lower mainly because:
1. Farm purchase cost increased 5%.
2. Trip loss increased from 1.2% to 2.4%.
3. Fuel expense increased.
4. Retailer C received a special rate.
```

The assistant should explain data already present in the system rather than inventing reasons.

---

# 60. Natural Language Business Queries

Future:

```text
Show retailers with outstanding above ₹50,000.

Which farm had the lowest purchase rate this week?

Which route had the highest weight loss?

How much did we sell yesterday?

Who has not paid in 7 days?

Which retailer increased order quantity the most?
```

This can become a major differentiator.

---

# 61. Business Intelligence

Advanced KPIs:

### Sales

- Revenue/day
- Revenue/retailer
- Revenue/kg

### Margin

- Margin/kg
- Margin/retailer
- Margin/trip

### Operations

- Delivery completion %
- On-time %
- Average delivery time
- Weight loss %

### Credit

- Collection %
- Outstanding
- DSO
- Overdue %

---

# 62. Forecasting Dashboard

Future:

```text
Tomorrow demand: 3,100 kg
Expected orders: 45
Recommended farm procurement: 3,170 kg
Expected vehicles: 4
```

Add confidence range:

```text
Expected: 3,100 kg
Likely range: 2,900–3,300 kg
```

---

# 63. Farm Procurement Planning

The system can calculate:

```text
Expected demand
+
Expected loss
+
Safety stock
=
Recommended procurement
```

Example:

```text
Expected demand: 3,000 kg
Expected loss:     45 kg
Safety buffer:     75 kg
--------------------------
Procure:         3,120 kg
```

Make all assumptions configurable.

---

# 64. Vehicle Capacity Planning

Before assigning a route:

```text
Required: 1,250 kg
Vehicle capacity: 1,000 kg

WARNING:
Vehicle capacity exceeded by 250 kg.
```

Suggest:

- second vehicle
- split route
- move retailer
- change vehicle

---

# 65. Route Optimization Approaches

### Approach 1 — Manual

Admin chooses sequence.

Best for MVP.

### Approach 2 — Simple geographic

Group retailers by area.

### Approach 3 — Waypoint optimization

Optimize stop sequence using route APIs.

### Approach 4 — Full fleet optimization

Optimize:

- vehicles
- drivers
- capacity
- delivery windows
- stop order
- route cost

Use only after operational data is reliable.

---

# 66. Multi-Branch Expansion

Future architecture:

```text
Organization
├── Branch A
├── Branch B
└── Branch C
```

Each branch:

- Retailers
- Vehicles
- Staff
- Inventory
- Farms
- Rates

Organization-level reporting:

```text
Branch A sales
Branch B sales
Branch C sales
----------------
Total company sales
```

---

# 67. Multi-Farm Procurement

Support:

```text
Farm A
Farm B
Farm C
```

Compare:

- rate
- bird weight
- loss
- quality
- reliability
- payment terms

Farm score:

```text
Price
+
Quality
+
Consistency
+
Availability
+
Loss
```

---

# 68. Supplier Ledger

Farmers/suppliers can also have ledgers:

- Purchase
- Payment
- Outstanding
- Advance
- Adjustment
- Credit note

This turns the app into a complete wholesale accounting workflow.

---

# 69. Cold Chain / Temperature Module

Future if processed/chilled products are handled.

Track:

- Temperature
- Vehicle temperature
- Cold room temperature
- Time
- Alarm threshold

Possible sensors:

```text
BLE temperature sensor
        ↓
Android
        ↓
API
        ↓
Alert
```

---

# 70. Quality Control

Record:

- Quality grade
- Rejected quantity
- Reason
- Farm
- Batch
- Retailer complaint

Complaint lifecycle:

```text
Reported
↓
Assigned
↓
Investigating
↓
Resolved
↓
Closed
```

---

# 71. Traceability

For every delivery:

```text
Retailer
  ↓
Bill
  ↓
Delivery
  ↓
Vehicle / Driver
  ↓
Trip
  ↓
Farm Load
  ↓
Farm
```

This creates end-to-end traceability.

---

# 72. Food Safety / Compliance

The system should provide fields and document storage for relevant compliance information.

FSSAI states that food business operators in India are required to be licensed/registered, with different categories depending on the business and scale. Its official materials also include food distribution, wholesale and related businesses within the licensing framework. citeturn0search1turn0search0

Therefore, provide optional:

- FSSAI number
- License type
- Issue date
- Expiry date
- Document
- Renewal reminder

Do not hard-code licensing eligibility rules into the app without validating the current official criteria for the specific business.

---

# 73. GST / Tax Readiness

The application should be tax-ready even if the first customer does not require every tax feature.

Support data fields for:

- GSTIN
- Tax category
- HSN/SAC where applicable
- Tax rate
- CGST
- SGST
- IGST
- Taxable amount
- Invoice number
- Invoice date

Future integrations:

- GST invoice workflows
- e-invoice where applicable
- e-way bill where applicable

**Important:** tax applicability and thresholds should be verified against current official GST rules before enabling automated compliance logic.

---

# 74. Document Storage

Store references rather than large blobs in PostgreSQL.

Possible documents:

- FSSAI certificate
- GST certificate
- Vehicle documents
- Insurance
- Driver documents
- Purchase bills
- Expense receipts
- Delivery photos

Use S3-compatible object storage.

---

# 75. Security

Minimum:

- JWT authentication
- Refresh token strategy
- Argon2 password hashing
- RBAC
- Tenant isolation
- Device registration
- Session revocation
- Rate limiting
- Audit logs
- HTTPS
- Secure local storage
- Encryption for sensitive local data
- Input validation

---

# 76. Tenant Isolation

Every tenant request must be scoped correctly.

Never trust:

```text
tenant_id
```

from the client as the only security boundary.

Tenant should be derived from authenticated server-side context.

The current architecture uses schema-per-tenant with a public control plane and tenant schema. fileciteturn0file1L137-L146

---

# 77. API Architecture

Suggested API domains:

```text
/auth
/super-admin
/organizations
/users
/retailers
/orders
/farms
/procurement
/vehicles
/drivers
/routes
/delivery-runs
/deliveries
/weighing
/bills
/payments
/ledger
/inventory
/returns
/expenses
/reports
/notifications
/whatsapp
/devices
/scales
/printers
/audit
/sync
```

---

# 78. API Design Principles

Use:

- REST
- Pydantic DTOs
- Structured errors
- Cursor pagination
- Idempotency keys
- Request IDs
- Consistent timestamps
- Explicit business dates
- Transaction boundaries

The existing architecture already specifies structured errors, cursor pagination and IST business timezone. fileciteturn0file1L172-L179

---

# 79. Database Approach

Recommended PostgreSQL.

Important principles:

- UUID primary IDs
- Unique constraints
- Foreign keys
- Check constraints
- Decimal/numeric for money
- Numeric for weight
- Timestamps with timezone
- Immutable financial history
- Index operational queries
- Soft-delete only where appropriate

Do not use floating point for financial values.

---

# 80. Event / Transaction Approach

Important business actions can generate events:

```text
ORDER_CREATED
ORDER_CONFIRMED
LOAD_CREATED
TRIP_STARTED
DELIVERY_COMPLETED
BILL_CREATED
PAYMENT_RECEIVED
RETURN_CREATED
WEIGHT_LOSS_DETECTED
PRINT_FAILED
SYNC_COMPLETED
```

This makes future analytics and integrations easier.

---

# 81. Outbox Pattern

For reliable notifications:

```text
Business transaction
       ↓
DB transaction
       ↓
Outbox event
       ↓
Worker
       ↓
WhatsApp / Push / Email
```

Do not send an external notification halfway through a DB transaction and then risk inconsistent state.

---

# 82. Background Jobs

Useful jobs:

- WhatsApp messages
- PDF generation
- Reports
- Daily closing
- Payment reminders
- Expiry reminders
- Analytics aggregation
- Sync processing
- Notification retries

Possible infrastructure:

- Redis
- Background worker
- Scheduled job runner

---

# 83. PDF / Receipt Strategy

Server-side:

- Daily reports
- Ledger statements
- Purchase reports
- Sales reports
- Weight-loss reports
- Profit reports

Device-side:

- Fast thermal receipt

Keep both separate.

---

# 84. Search

Global search:

```text
Retailer
Bill
Order
Trip
Vehicle
Driver
Farm
Payment
```

Search by:

- Name
- Mobile
- Bill number
- Date
- Vehicle
- Route

---

# 85. Barcode / QR Possibilities

Future:

- Retailer QR
- Delivery QR
- Bill QR
- Crate QR
- Vehicle QR
- Scale QR

A delivery staff member can scan a retailer QR and immediately open the correct delivery screen.

---

# 86. Voice Input

Useful in delivery environments.

Examples:

> "Delivered 145 kilograms."

> "Collected 5,000 cash."

Voice should convert to structured input and require confirmation before financial submission.

---

# 87. Tamil / English

The product should support:

- English
- Tamil

Later:

- Hindi
- Malayalam
- Telugu
- Kannada

Keep translations in localization files.

Do not hard-code UI strings.

---

# 88. Accessibility

Support:

- Large touch targets
- High contrast
- Clear numeric display
- Large weight numbers
- Simple delivery workflow
- Minimal typing
- Voice support
- Screen reader labels where practical

Delivery users often work quickly and outdoors, so operational readability is more important than decorative UI.

---

# 89. UI Design Principles

## Admin

Data-dense.

## Delivery

Fast and simple.

## Retailer

Minimal and self-service.

### Delivery screen rule

The user should be able to complete a delivery with:

```text
Open retailer
→ connect/read scale
→ confirm weight
→ payment
→ print
→ next retailer
```

---

# 90. Three-App vs One-App Approach

## Approach A — One app with roles

```text
Login
 ↓
Role
 ├── Admin
 ├── Delivery Staff
 └── Retailer
```

### Advantages

- One codebase
- Easier deployment
- Shared components

### Disadvantages

- More conditional UI
- Larger app

## Approach B — Separate apps

```text
Admin App
Delivery App
Retailer App
```

### Advantages

- Very focused UX
- Smaller role-specific apps

### Disadvantages

- More maintenance
- More deployments
- More app stores/releases

### Recommendation

Start with **one Expo application with role-based navigation**.

Split into separate apps only when scale justifies it.

---

# 91. Web Admin Approach

Mobile-first does not mean mobile-only.

Recommended web later for:

- Large reports
- Data export
- Retailer management
- Rate management
- Accounting
- Dashboard
- User management
- Multi-branch administration

The current architecture already plans a Vite React web layer as an optional/secondary interface. fileciteturn0file1L45-L47

---

# 92. Export

Allow:

- PDF
- Excel
- CSV

Reports:

- Sales
- Purchase
- Delivery
- Retailer ledger
- Payments
- Weight loss
- Expenses
- Profit

---

# 93. Backup Strategy

Recommended:

```text
PostgreSQL
 ↓
Automated daily backup
 ↓
Encrypted storage
 ↓
Retention policy
```

Also:

- point-in-time recovery where available
- backup monitoring
- restore testing

A backup that has never been restored is not proven.

---

# 94. Monitoring

Track:

- API latency
- API errors
- DB connections
- Queue failures
- Sync failures
- Printer errors
- BLE errors
- Crash reports
- Login failures

---

# 95. App Version Management

Show:

```text
Current version: 1.5.2
Latest version: 1.5.3
```

Support:

- mandatory update
- optional update
- minimum supported version

---

# 96. Deployment Architecture

Current direction:

```text
Internet
   ↓
Caddy
   ↓
FastAPI
   ↓
PostgreSQL
   ↓
Redis / Workers
   ↓
Object Storage
```

Android:

```text
Expo React Native
   ↓
Android
   ├── BLE scale
   └── Thermal printer
```

The current architecture uses FastAPI + PostgreSQL schema-per-tenant + Caddy + optional S3-compatible storage. fileciteturn0file1L60-L70

---

# 97. MVP Scope

Do not build everything initially.

## MVP 1

### Admin

- Login
- Retailers
- Farms
- Rates
- Orders
- Farm load
- Delivery runs
- Bills
- Payments
- Ledger
- Basic reports

### Delivery

- Today's route
- Retailer delivery
- Manual weight
- BLE scale
- Thermal print
- Payment

### Retailer

- Login
- Order
- Delivery history
- Bills
- Outstanding

### Core analytics

- Loaded kg
- Delivered kg
- Loss kg
- Loss %
- Sales
- Collection
- Outstanding

---

# 98. MVP 2

Add:

- WhatsApp
- GPS
- Route management
- Expense management
- Returns
- Supplier ledger
- Advanced reports
- Offline sync improvements
- Device management

---

# 99. Version 3

Add:

- Demand forecasting
- Procurement recommendation
- Route optimization
- Credit risk
- Profitability analytics
- AI assistant
- Multi-branch
- Multi-farm analytics
- Customer portal improvements

---

# 100. Long-Term Platform

The final product can evolve into:

```text
BROILER 360
│
├── Wholesale
├── Farm Procurement
├── Delivery
├── Retailer Portal
├── Inventory
├── Accounting
├── Payments
├── Fleet
├── Analytics
├── AI
└── Multi-Branch
```

---

# 101. Alternative Business Approaches

## Approach A — SaaS

Charge monthly.

Best for scalable recurring revenue.

## Approach B — One-time software

Customer pays once.

Simple but harder to maintain recurring revenue.

## Approach C — SaaS + hardware

Sell:

- Software
- Scale integration
- Printer integration
- Setup
- Support

Potentially stronger differentiation.

## Approach D — Enterprise custom deployment

For large wholesalers:

- Custom workflows
- Dedicated environment
- Custom reports
- API
- SLA

### Recommended

**SaaS + onboarding + optional hardware integration + premium support.**

---

# 102. Hardware Revenue Opportunity

Possible bundle:

```text
Software subscription
+
Bluetooth weighing scale
+
Thermal printer
+
Android device
+
Setup
+
Training
```

This creates a complete solution instead of only selling software.

---

# 103. Customer Onboarding

Recommended onboarding:

```text
Create organization
↓
Add branches
↓
Add farms
↓
Add retailers
↓
Add staff
↓
Add vehicles
↓
Configure rates
↓
Pair scale
↓
Pair printer
↓
Import opening balances
↓
Test delivery
↓
Go live
```

---

# 104. Data Import

Support Excel/CSV import for:

- Retailers
- Opening balances
- Farms
- Rates
- Vehicles
- Drivers

Provide validation before import.

Example:

```text
100 rows
95 valid
3 duplicate
2 invalid mobile
```

---

# 105. Migration from Notebook

This is a major sales angle.

Customer can move:

```text
Notebook
   ↓
Excel
   ↓
Digital system
```

Migration service can include:

- Retailer master
- Opening balances
- Rates
- Farm list
- Vehicle list

---

# 106. Training Mode

Add demo mode:

```text
Demo organization
```

Users can practice:

- Order
- Loading
- Delivery
- Printing
- Payment

without affecting production data.

---

# 107. Support Tools

Admin support can inspect:

- Tenant
- User
- Device
- Last sync
- Failed sync
- Printer status
- Scale status
- Last bill
- API errors

But support access should be:

- explicitly authorized
- audited
- time-limited

---

# 108. Product Differentiation

Do not market this as:

> "Another billing app."

Market it as:

> **A complete daily operating system for broiler wholesalers.**

Core differentiators:

1. Retailer daily ordering
2. Farm-to-retailer traceability
3. Bluetooth scale integration
4. Instant thermal receipts
5. Delivery route control
6. Weight-loss intelligence
7. Retailer credit ledger
8. Offline delivery
9. Profitability analytics
10. WhatsApp communication

---

# 109. Strongest Unique Feature

The strongest domain-specific loop is:

```text
ORDER
 ↓
PROCUREMENT
 ↓
LOAD
 ↓
DELIVERY
 ↓
WEIGH
 ↓
BILL
 ↓
PAY
 ↓
LOSS
 ↓
PROFIT
```

Most generic POS products start from:

```text
Cart → Bill → Payment
```

This product should start from:

```text
Demand → Supply → Movement → Measurement → Money
```

That is the real product identity.

---

# 110. Data Model Relationship

```text
Retailer
   │
   ├── Orders
   │      │
   │      └── Delivery Allocation
   │
   ├── Deliveries
   │      │
   │      └── Bill
   │             │
   │             └── Ledger
   │
   └── Payments

Farm
   │
   └── Farm Load
          │
          └── Delivery Run
                 │
                 ├── Vehicle
                 ├── Driver
                 └── Delivery Stops
                        │
                        └── Retailers
```

---

# 111. Recommended Technical Approach

Use the existing Duro_POS-aligned stack as the base:

- FastAPI
- SQLAlchemy 2 async
- Alembic
- PostgreSQL
- Expo React Native
- TypeScript
- Zustand
- React Navigation
- NativeWind/Tamagui where appropriate
- BLE integration
- ESC/POS thermal printing
- Caddy
- Redis/background jobs
- S3-compatible object storage

The architecture document explicitly identifies these as the adopted stack and patterns. fileciteturn0file1L60-L70

---

# 112. Important Architecture Correction

The existing architecture mentions a `preview → print → commit` billing pattern inherited from Duro_POS. fileciteturn0file1L172-L175

For this wholesale application, the safer production design is:

```text
PREPARE
  ↓
VALIDATE
  ↓
COMMIT FINANCIAL TRANSACTION
  ↓
PRINT
  ↓
TRACK PRINT STATUS
```

Reason:

**A printer is an external hardware dependency and must not determine whether a financial transaction exists.**

The system should guarantee:

- Bill persistence
- Idempotency
- Inventory consistency
- Ledger consistency
- Reprint capability

---

# 113. Critical Transaction Rules

## Bill creation

One database transaction should cover:

```text
Bill
+
Bill Items
+
Delivery
+
Ledger Entry
+
Inventory Movement
```

## Payment

One transaction:

```text
Payment
+
Ledger Entry
```

## Return

One transaction:

```text
Return
+
Inventory Reversal
+
Bill Adjustment
+
Ledger Adjustment
```

---

# 114. Testing Strategy

## Unit tests

- Weight calculations
- Loss calculations
- Pricing
- Ledger balance
- Credit limit
- Payment allocation
- Tax calculations
- Route calculations

## Integration tests

- Order → delivery
- Delivery → bill
- Bill → ledger
- Payment → ledger
- Return → reversal

## Hardware tests

- Scale connection
- Scale disconnect
- Unstable weight
- Printer connection
- Printer failure
- Reprint

## Offline tests

- Create offline delivery
- Kill app
- Restore internet
- Sync
- Retry
- Duplicate sync request

## Concurrency tests

- Two devices deliver same order
- Two users edit same retailer
- Duplicate payment
- Duplicate checkout

---

# 115. Acceptance Criteria for MVP

The MVP should not be considered complete until:

- No duplicate bills
- No duplicate payments
- No lost bills
- No lost delivery records
- Manual weighing works
- BLE weighing works with the selected scale
- Printer works
- Printer failure does not lose the bill
- Offline delivery can sync
- Retailer ledger is accurate
- Weight-loss calculation is reproducible
- Reports match transaction data
- Historical rates remain unchanged
- Cancelled transactions remain auditable

---

# 116. Recommended Development Order

```text
Phase 1
Auth + Tenant + Retailer
        ↓
Phase 2
Orders
        ↓
Phase 3
Farm + Load
        ↓
Phase 4
Delivery Run
        ↓
Phase 5
Manual Weighing
        ↓
Phase 6
BLE Scale
        ↓
Phase 7
Billing + Ledger
        ↓
Phase 8
Thermal Printing
        ↓
Phase 9
Payments
        ↓
Phase 10
Reports
        ↓
Phase 11
Offline Sync
        ↓
Phase 12
WhatsApp
        ↓
Phase 13
GPS / Routes
        ↓
Phase 14
Advanced Analytics
        ↓
Phase 15
AI
```

---

# 117. What NOT to Build First

Avoid initially building:

- Full accounting ERP
- Complex AI
- Fleet optimization
- Multi-country tax engine
- Huge CRM
- Complex inventory forecasting
- Customer marketplace
- Advanced cold-chain sensors
- Too many payment gateways
- Separate apps for every role

First make the daily delivery loop extremely reliable.

---

# 118. The Core Product Loop

The product should make this daily operation almost effortless:

```text
06:00
Retailer orders arrive

07:00
Admin sees total requirement

07:15
Farm procurement planned

08:00
Vehicle loaded

08:30
Delivery route starts

09:00
Retailer A weighed

09:10
Receipt printed

09:20
Retailer B weighed

...

13:00
All deliveries completed

14:00
Dashboard shows:

Loaded:       3,200 kg
Delivered:    3,120 kg
Loss:            80 kg
Sales:        ₹X
Collected:    ₹X
Outstanding:  ₹X
Expenses:     ₹X
Profit:       ₹X
```

This is the experience the product should optimize for.

---

# 119. Research-Based External Integration Opportunities

## Bluetooth

Android officially supports BLE scanning, GATT service discovery, connection and characteristic-based data transfer, which supports the proposed scale-integration approach. citeturn0search2

## Route optimization

Google Maps currently provides route optimization capabilities that can consider vehicle capacity, time windows, driver hours, load balancing and other constraints. citeturn1search0

## Food compliance

FSSAI's current official material confirms licensing/registration requirements for food businesses and provides eligibility/compliance resources. citeturn0search1turn0search12

---

# 120. Product Roadmap Summary

| Stage | Product |
|---|---|
| V1 | Digital order + delivery + billing |
| V1.1 | BLE scale + printer |
| V1.2 | Ledger + payment |
| V1.3 | Reports + WhatsApp |
| V2 | Offline + GPS + routes |
| V2.1 | Supplier + expense + returns |
| V2.2 | Multi-branch |
| V3 | Forecasting + procurement intelligence |
| V3.1 | Profitability intelligence |
| V3.2 | AI assistant |
| V4 | Hardware ecosystem |
| V4.1 | Enterprise APIs |
| V4.2 | Full poultry business platform |

---

# 121. Final Recommended Approach

### Build the first version around five things:

## 1. Orders

Know exactly what every retailer needs.

## 2. Loading

Know exactly what left the farm.

## 3. Delivery + Weighing

Know exactly what each retailer received.

## 4. Billing + Ledger

Know exactly what money is owed.

## 5. Weight Loss + Profit

Know exactly where the business is making or losing money.

Everything else should support these five.

---

# 122. Final Product Positioning

## Internal product definition

> **Broiler Wholesale Management Platform for end-to-end order, procurement, delivery, weighing, billing, collection, ledger, loss and profitability management.**

## Customer-facing positioning

> **From farm loading to retailer payment — manage your entire broiler wholesale business from one app.**

## Strong one-line pitch

> **Know what was ordered, what was loaded, what was delivered, what was lost, and what you earned — every day.**

---

# 123. Source / Reference Notes

### User-provided product proposal

The original proposal defines the core workflow of retailer orders, farm loading, Bluetooth weighing, thermal printing, retailer ledger and weight-loss reporting.

### User-provided architecture

The current architecture document defines the Duro_POS-aligned FastAPI/PostgreSQL/Expo stack, multi-tenant schema architecture, domain flow, roles, API conventions and target project structure.

### External research used for expansion

- Food Safety and Standards Authority of India (FSSAI): licensing, registration and food-business compliance resources.
- Android Developers: Bluetooth Low Energy / GATT architecture.
- Google Maps Platform: Routes and Route Optimization APIs.

---

# 124. Historical Architecture Note

The existing architecture change history should remain intact. New architectural decisions should be appended rather than overwriting previous decisions.

The current repository architecture already records the pivot from LedgerDesk to the Broiler Wholesale Management App and the implementation landing under `backend/` and `frontend/`. fileciteturn0file1L324-L326

---

# 125. Decision Log — Recommended New Decisions

| Decision | Recommendation | Reason |
|---|---|---|
| Product focus | Broiler wholesale operations | Strong domain differentiation |
| Client | Android-first | Delivery + hardware |
| Admin web | Add after core mobile workflow | Data-heavy office work |
| Tenancy | Schema-per-tenant | Strong isolation |
| Weighing | BLE abstraction layer | Multiple scale vendors |
| Printing | ESC/POS abstraction | Multiple printers |
| Billing | Persist first, print second | Financial reliability |
| Offline | Local outbox + sync | Field reliability |
| Ledger | Immutable transactions | Auditability |
| Weight loss | Configurable thresholds | Business-specific |
| Route optimization | Phase 2+ | Requires operational data |
| AI | Phase 3+ | Requires historical data |
| Hardware bundle | Optional | Strong SaaS differentiation |
| Compliance | Configurable fields + reminders | Avoid hard-coded legal assumptions |

---

# 126. North-Star Metric

The main success metric should not be:

> Number of bills created.

Better:

> **Percentage of daily wholesale operations completed digitally from order to delivery to payment.**

Supporting metrics:

- Digital order rate
- Delivery completion rate
- Digital weighing rate
- Print success rate
- Bill persistence success rate
- Payment collection rate
- Sync success rate
- Weight-loss visibility
- Retailer active rate

---

# 127. Final Product Architecture

```text
                         BROILER WHOLESALE PLATFORM
                                  │
             ┌────────────────────┼────────────────────┐
             │                    │                    │
          RETAILER              ADMIN               DELIVERY
             │                    │                    │
          Orders              Dashboard              Route
          Payments            Procurement             Weigh
          Ledger              Retailers               Print
          History             Farms                   Collect
             │                    │                    │
             └────────────────────┼────────────────────┘
                                  │
                              FASTAPI
                                  │
                     ┌────────────┼────────────┐
                     │            │            │
                 PostgreSQL     Redis      Object Store
                     │
              Schema-per-Tenant
                     │
        ┌────────────┼────────────┐
        │            │            │
      Orders       Delivery     Finance
        │            │            │
      Farm Load    Weighing     Ledger
        │            │            │
      Vehicle      Printer      Payments
        │            │            │
      Route        GPS          Reports
                     │
                  Analytics
                     │
                    AI
```

---

# 128. Conclusion

The Broiler Wholesale Management App should be developed as a **specialized poultry wholesale operating platform**, not as a generic POS.

The MVP should make the daily operational chain reliable:

**Retailer Order → Farm Load → Delivery Run → Actual Weight → Receipt → Bill → Payment → Ledger → Weight Loss**

Once this foundation is reliable, the same data can power:

**Route Optimization → Procurement Planning → Credit Intelligence → Profitability → Forecasting → AI**

That gives Durozen a product with a clear initial use case and a strong path toward a full poultry-business SaaS platform.

---

## Prepared By

**Durozen Technologies Pvt. Ltd.**

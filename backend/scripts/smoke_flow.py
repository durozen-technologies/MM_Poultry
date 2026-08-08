import os
import uuid

import httpx

b = os.environ.get("API_BASE", "http://127.0.0.1:8000").rstrip("/") + "/api/v1"
admin = httpx.post(
    b + "/auth/login",
    json={"username": "admin", "password": "password123", "organization_slug": "demo"},
).json()
h = {"Authorization": "Bearer " + admin["access_token"]}
dash = httpx.get(b + "/admin/dashboard", headers=h).json()
print("dashboard", dash["order_count"], dash["loss_status"], dash["outstanding"])
orders = httpx.get(b + "/admin/orders/today", headers=h).json()["items"]
oid = orders[0]["id"]
load = httpx.post(
    b + "/admin/farm-loads",
    headers=h,
    json={
        "loaded_weight_kg": "120.000",
        "vehicle_number": "TN01AB1234",
        "driver_name": "Ravi",
        "bird_count": 80,
    },
).json()
print("load", load["id"], load["loaded_weight_kg"])
run = httpx.post(
    b + "/admin/delivery-runs",
    headers=h,
    json={"farm_load_id": load["id"], "order_ids": [oid]},
).json()
print("run", run["id"], "stops", len(run["stops"]))
stop = run["stops"][0]["id"]
httpx.post(f"{b}/delivery/runs/{run['id']}/start", headers=h)
w = httpx.post(
    f"{b}/delivery/stops/{stop}/weigh",
    headers=h,
    json={
        "delivered_weight_kg": "48.250",
        "scale_device_id": "BLE-1",
        "delivered_bird_count": 32,
    },
).json()
print("weigh", w["delivered_weight_kg"], w["gross_amount"], w["status"], w.get("delivered_bird_count"))
prev = httpx.post(
    f"{b}/delivery/stops/{stop}/bill/preview",
    headers=h,
    json={"cash_payment": "1000", "upi_payment": "0"},
).json()
print("preview", prev)
checkout_id = str(uuid.uuid4())
bill = httpx.post(
    f"{b}/delivery/stops/{stop}/bill/commit",
    headers=h,
    json={
        "cash_payment": "1000",
        "upi_payment": "0",
        "print_status": "PENDING",
        "checkout_id": checkout_id,
    },
).json()
print("bill", bill["bill_number"], bill["balance_amount"], bill["print_status"], bill["checkout_id"])
printed = httpx.patch(
    f"{b}/delivery/bills/{bill['id']}/print-status",
    headers=h,
    json={"print_status": "PRINTED"},
).json()
print("print updated", printed["print_status"])
bill2 = httpx.post(
    f"{b}/delivery/stops/{stop}/bill/commit",
    headers=h,
    json={
        "cash_payment": "1000",
        "upi_payment": "0",
        "print_status": "PENDING",
        "checkout_id": checkout_id,
    },
).json()
print("idempotent checkout", bill2["bill_number"] == bill["bill_number"])
comp = httpx.post(f"{b}/delivery/runs/{run['id']}/complete", headers=h).json()
print("complete", comp["status"])
loss = httpx.get(f"{b}/admin/trips/{run['id']}/weight-loss", headers=h).json()
print("loss", loss)
rep = httpx.get(b + "/admin/reports/summary?period=daily", headers=h).json()
print("report", rep)
rid = orders[0]["retailer_id"]
led = httpx.get(f"{b}/admin/retailers/{rid}/ledger", headers=h).json()
print("ledger bal", led["credit_balance"], "entries", len(led["entries"]))
wa = httpx.patch(f"{b}/delivery/bills/{bill['id']}/whatsapp", headers=h).json()
print("whatsapp", wa["whatsapp_shared_at"] is not None)

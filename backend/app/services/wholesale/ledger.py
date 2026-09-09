from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.domain import (
    DeliveryBill,
    DeliveryRun,
    DeliveryStop,
    DeliveryStopItem,
    Item,
    Payment,
    RetailerReturn,
)
from app.models.enums import (
    PaymentType,
)
from app.schemas import (
    LedgerBillItem,
    LedgerEntry,
    LedgerOut,
    RetailerOut,
)
from app.services.wholesale.common import ZERO, q_money
from app.services.wholesale.retailers import get_retailer


async def get_ledger(db: AsyncSession, retailer_id: UUID) -> LedgerOut:
    retailer = await get_retailer(db, retailer_id)
    bills = list(
        await db.scalars(
            select(DeliveryBill)
            .options(selectinload(DeliveryBill.items))
            .where(DeliveryBill.retailer_id == retailer_id)
            .order_by(DeliveryBill.bill_date.asc(), DeliveryBill.created_at.asc())
        )
    )
    payments = list(
        await db.scalars(
            select(Payment)
            .where(Payment.retailer_id == retailer_id)
            .order_by(Payment.payment_date.asc(), Payment.created_at.asc())
        )
    )
    returns = list(
        await db.scalars(
            select(RetailerReturn)
            .where(RetailerReturn.retailer_id == retailer_id)
            .order_by(RetailerReturn.return_date.asc(), RetailerReturn.created_at.asc())
        )
    )
    stop_ids = [b.delivery_stop_id for b in bills]
    stop_map = {}
    if stop_ids:
        stop_stmt = (
            select(DeliveryStopItem.delivery_stop_id, DeliveryStopItem.item_id, DeliveryStopItem.delivered_boxes, Item.name)
            .join(Item, Item.id == DeliveryStopItem.item_id)
            .where(DeliveryStopItem.delivery_stop_id.in_(stop_ids))
        )
        stop_res = await db.execute(stop_stmt)
        for stop_id, it_id, boxes, item_name in stop_res:
            stop_map[(stop_id, it_id)] = (boxes or 0, item_name)

    bill_payments_map = {}
    for payment in payments:
        if payment.delivery_bill_id:
            bill_payments_map[payment.delivery_bill_id] = payment.notes

    driver_map = {}
    bill_ids = [b.id for b in bills]
    if bill_ids:
        driver_stmt = (
            select(DeliveryBill.id, DeliveryRun.driver_name)
            .join(DeliveryStop, DeliveryStop.id == DeliveryBill.delivery_stop_id)
            .join(DeliveryRun, DeliveryRun.id == DeliveryStop.delivery_run_id)
            .where(DeliveryBill.id.in_(bill_ids))
        )
        for b_id, d_name in await db.execute(driver_stmt):
            driver_map[b_id] = d_name or "Unknown Driver"

    entries: list[LedgerEntry] = []
    for bill in bills:
        total_wt = sum((i.weight_kg for i in bill.items), ZERO)
        rate_str = (
            f"@ {bill.items[0].rate_per_kg}"
            if len(bill.items) == 1
            else ("(Mixed Rates)" if len(bill.items) > 1 else "")
        )
        bill_items = []
        for i in bill.items:
            boxes, item_name = stop_map.get((bill.delivery_stop_id, i.item_id), (0, "Unknown Item"))
            bill_items.append(LedgerBillItem(item_name=item_name, boxes=boxes, net_kg=i.weight_kg, amount=i.amount))

        entries.append(
            LedgerEntry(
                entry_type="BILL",
                entry_date=bill.bill_date,
                reference=bill.bill_number,
                debit=bill.total_amount,
                credit=ZERO,
                notes=f"Wt {total_wt} kg {rate_str}".strip(),
                bill_items=bill_items,
            )
        )
        collected = bill.cash_payment + bill.upi_payment
        if collected > ZERO:
            driver_name = driver_map.get(bill.id, "Unknown Driver")
            base_notes = bill_payments_map.get(bill.id) or ""
            
            breakdowns = []
            if bill.cash_payment > ZERO:
                breakdowns.append(f"Cash ₹{bill.cash_payment}")
            if bill.upi_payment > ZERO:
                breakdowns.append(f"UPI ₹{bill.upi_payment}")
            
            note_str = f"Received by {driver_name}"
            if breakdowns:
                note_str += f"\n({', '.join(breakdowns)})"
            if base_notes:
                note_str += f" - {base_notes}"

            entries.append(
                LedgerEntry(
                    entry_type="Delivery Payment",
                    entry_date=bill.bill_date,
                    reference=bill.bill_number,
                    debit=ZERO,
                    credit=q_money(collected),
                    notes=note_str
                )
            )
    for payment in payments:
        if payment.delivery_bill_id:
            continue  # already represented via bill payment lines
            
        breakdowns = []
        if payment.cash_amount > ZERO:
            breakdowns.append(f"Cash ₹{payment.cash_amount}")
        if payment.upi_amount > ZERO:
            breakdowns.append(f"UPI ₹{payment.upi_amount}")
            
        note_str = ", ".join(breakdowns)
        if payment.notes:
            note_str = f"{note_str} - {payment.notes}" if note_str else payment.notes
            
        entries.append(
            LedgerEntry(
                entry_type="Admin Payment",
                entry_date=payment.payment_date,
                reference=str(payment.id),
                debit=ZERO,
                credit=payment.total_amount
                if payment.type == PaymentType.RECEIVED and payment.is_credit
                else ZERO,
                notes=note_str,
            )
        )
    for ret in returns:
        entries.append(
            LedgerEntry(
                entry_type="RETURN",
                entry_date=ret.return_date,
                reference=str(ret.id),
                debit=ZERO,
                credit=ret.total_amount,
                notes=f"Return {ret.weight_kg}kg " + (ret.reason or ""),
            )
        )
    entries.sort(key=lambda e: (e.entry_date, e.entry_type))
    running = q_money(retailer.opening_balance)
    for entry in entries:
        running = q_money(running + entry.debit - entry.credit)
        entry.balance_after = running

    from app.models.user import User

    has_portal_access = await db.scalar(
        select(select(User).where(User.retailer_id == retailer_id).exists())
    )

    retailer_out = RetailerOut.model_validate(retailer, from_attributes=True)
    retailer_out.has_portal_access = has_portal_access or False

    return LedgerOut(
        retailer=retailer_out,
        opening_balance=retailer.opening_balance,
        credit_balance=retailer.credit_balance,
        entries=entries,
    )

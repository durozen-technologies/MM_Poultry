from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.timezone import today_ist
from app.models.domain import (
    DeliveryBill,
    Payment,
    RetailerReturn,
)
from app.models.enums import (
    PaymentType,
)
from app.schemas import (
    LedgerEntry,
    LedgerOut,
    PaymentCreate,
    PaymentOut,
    RetailerOut,
    RetailerReturnCreate,
    RetailerReturnOut,
)
from app.services.wholesale.common import ZERO, q_money
from app.services.wholesale.retailers import get_retailer


async def create_payment(db: AsyncSession, retailer_id: UUID, payload: PaymentCreate) -> PaymentOut:
    retailer = await get_retailer(db, retailer_id)
    total = q_money(payload.cash_amount + payload.upi_amount)
    if total <= ZERO:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Payment amount required"
        )
    # Ensure total matches sum after quantize
    if q_money(payload.cash_amount) + q_money(payload.upi_amount) != total:
        total = q_money(q_money(payload.cash_amount) + q_money(payload.upi_amount))
    payment = Payment(
        retailer_id=retailer_id,
        payment_date=payload.payment_date or today_ist(),
        cash_amount=q_money(payload.cash_amount),
        upi_amount=q_money(payload.upi_amount),
        total_amount=total,
        type=payload.type,
        is_credit=payload.is_credit,
        notes=payload.notes,
    )
    db.add(payment)
    if payload.type == PaymentType.RECEIVED and payload.is_credit:
        retailer.credit_balance = q_money(retailer.credit_balance - total)
    await db.flush()
    return PaymentOut.model_validate(payment, from_attributes=True)


async def create_return(
    db: AsyncSession, retailer_id: UUID, payload: RetailerReturnCreate
) -> RetailerReturnOut:
    retailer = await get_retailer(db, retailer_id)
    if payload.total_amount <= ZERO:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Total amount required")
    # ownership check for delivery_bill_id
    if payload.delivery_bill_id is not None:
        bill = await db.scalar(
            select(DeliveryBill).where(DeliveryBill.id == payload.delivery_bill_id)
        )
        if bill is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Delivery bill not found"
            )
        if bill.retailer_id != retailer_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Delivery bill does not belong to this retailer",
            )

    ret = RetailerReturn(
        retailer_id=retailer_id,
        return_date=payload.return_date or today_ist(),
        delivery_bill_id=payload.delivery_bill_id,
        weight_kg=payload.weight_kg,
        bird_count=payload.bird_count,
        rate_per_kg=payload.rate_per_kg,
        total_amount=payload.total_amount,
        reason=payload.reason,
    )
    db.add(ret)

    # Credit the retailer's balance
    retailer.credit_balance = q_money(retailer.credit_balance - payload.total_amount)

    await db.flush()
    return RetailerReturnOut.model_validate(ret, from_attributes=True)


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
    entries: list[LedgerEntry] = []
    for bill in bills:
        total_wt = sum((i.weight_kg for i in bill.items), ZERO)
        rate_str = (
            f"@ {bill.items[0].rate_per_kg}"
            if len(bill.items) == 1
            else ("(Mixed Rates)" if len(bill.items) > 1 else "")
        )
        entries.append(
            LedgerEntry(
                entry_type="BILL",
                entry_date=bill.bill_date,
                reference=bill.bill_number,
                debit=bill.total_amount,
                credit=ZERO,
                notes=f"Wt {total_wt} kg {rate_str}".strip(),
            )
        )
        collected = bill.cash_payment + bill.upi_payment
        if collected > ZERO:
            entries.append(
                LedgerEntry(
                    entry_type="BILL_PAYMENT",
                    entry_date=bill.bill_date,
                    reference=bill.bill_number,
                    debit=ZERO,
                    credit=q_money(collected),
                )
            )
    for payment in payments:
        if payment.delivery_bill_id:
            continue  # already represented via bill payment lines
        entries.append(
            LedgerEntry(
                entry_type="PAYMENT",
                entry_date=payment.payment_date,
                reference=str(payment.id),
                debit=ZERO,
                credit=payment.total_amount
                if payment.type == PaymentType.RECEIVED and payment.is_credit
                else ZERO,
                notes=payment.notes,
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

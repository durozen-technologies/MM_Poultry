from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import (
    DeliveryBill,
    DeliveryBillItem,
    Payment,
    RetailerDailyOrder,
    RetailerDailyOrderItem,
)
from app.models.enums import (
    OrderStatus,
    PaymentType,
)
from app.schemas import (
    ReportSummary,
)
from app.services.wholesale.common import q_kg, q_money

_ZERO = Decimal("0")


async def report_summary(db: AsyncSession, start: date, end: date) -> ReportSummary:
    ordered = await db.scalar(
        select(func.coalesce(func.sum(RetailerDailyOrderItem.requested_kg), 0))
        .join(RetailerDailyOrder, RetailerDailyOrder.id == RetailerDailyOrderItem.order_id)
        .where(
            RetailerDailyOrder.order_date >= start,
            RetailerDailyOrder.order_date <= end,
            RetailerDailyOrder.status != OrderStatus.CANCELLED,
        )
    )

    delivered = await db.scalar(
        select(func.coalesce(func.sum(DeliveryBillItem.weight_kg), 0))
        .join(DeliveryBill, DeliveryBill.id == DeliveryBillItem.delivery_bill_id)
        .where(
            DeliveryBill.bill_date >= start,
            DeliveryBill.bill_date <= end,
        )
    )
    sales = await db.scalar(
        select(func.coalesce(func.sum(DeliveryBill.total_amount), 0)).where(
            DeliveryBill.bill_date >= start,
            DeliveryBill.bill_date <= end,
        )
    )
    collections = await db.scalar(
        select(func.coalesce(func.sum(Payment.total_amount), 0)).where(
            Payment.payment_date >= start,
            Payment.payment_date <= end,
            Payment.type == PaymentType.RECEIVED,
        )
    )
    total_loss = q_kg(_ZERO)

    return ReportSummary(
        period_start=start,
        period_end=end,
        total_ordered_kg=q_kg(Decimal(str(ordered or 0))),
        total_delivered_kg=q_kg(Decimal(str(delivered or 0))),
        total_sales_amount=q_money(Decimal(str(sales or 0))),
        total_collections=q_money(Decimal(str(collections or 0))),
        total_loss_kg=total_loss,
    )


def build_report_pdf(summary: ReportSummary) -> bytes:
    from io import BytesIO

    from reportlab.lib.pagesizes import A4  # type: ignore[import-untyped]
    from reportlab.pdfgen import canvas  # type: ignore[import-untyped]

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, 800, "Broiler Wholesale Report")
    c.setFont("Helvetica", 11)
    y = 770
    lines = [
        f"Period: {summary.period_start} to {summary.period_end}",
        f"Ordered kg: {summary.total_ordered_kg}",
        f"Delivered kg: {summary.total_delivered_kg}",
        f"Sales amount: {summary.total_sales_amount}",
        f"Collections: {summary.total_collections}",
        f"Weight loss kg: {summary.total_loss_kg}",
    ]
    for line in lines:
        c.drawString(50, y, line)
        y -= 22
    c.showPage()
    c.save()
    return buffer.getvalue()

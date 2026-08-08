from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.core.ids import UUID_SQL_TYPE, uuid7
from app.core.timezone import now_ist
from app.db.database import Base
from app.models.base import BaseModelMixin
from app.models.enums import (
    DeliveryRunStatus,
    DeliveryStopStatus,
    FarmLoadStatus,
    OrderStatus,
    PaymentType,
    PrintStatus,
)


class Retailer(Base, BaseModelMixin):
    __tablename__ = "retailers"

    id: Mapped[UUID] = mapped_column(UUID_SQL_TYPE, primary_key=True, default=uuid7)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    shop_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    alternate_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=text("true"), nullable=False
    )
    opening_balance: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, server_default=text("0.00")
    )
    credit_balance: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, server_default=text("0.00")
    )
    owner_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    whatsapp: Mapped[str | None] = mapped_column(String(30), nullable=True)
    area: Mapped[str | None] = mapped_column(String(120), nullable=True)
    route_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    category: Mapped[str | None] = mapped_column(String(60), nullable=True)
    credit_limit: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, server_default=text("0.00")
    )
    preferred_delivery_time: Mapped[str | None] = mapped_column(String(40), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_ist,
        onupdate=now_ist,
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )


class RetailerItemRate(Base, BaseModelMixin):
    __tablename__ = "retailer_item_rates"

    id: Mapped[UUID] = mapped_column(UUID_SQL_TYPE, primary_key=True, default=uuid7)
    retailer_id: Mapped[UUID | None] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("retailers.id"), nullable=True, index=True
    )
    rate_per_kg: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)


class RetailerDailyOrder(Base, BaseModelMixin):
    __tablename__ = "retailer_daily_orders"
    __table_args__ = (
        UniqueConstraint("retailer_id", "order_date", name="uq_retailer_daily_order"),
    )

    id: Mapped[UUID] = mapped_column(UUID_SQL_TYPE, primary_key=True, default=uuid7)
    retailer_id: Mapped[UUID] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("retailers.id"), nullable=False, index=True
    )
    order_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    requested_kg: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[OrderStatus] = mapped_column(
        SqlEnum(OrderStatus, name="order_status", native_enum=False),
        nullable=False,
        default=OrderStatus.PLACED,
    )
    created_by_user_id: Mapped[UUID | None] = mapped_column(UUID_SQL_TYPE, nullable=True)


class Farm(Base, BaseModelMixin):
    __tablename__ = "farms"

    id: Mapped[UUID] = mapped_column(UUID_SQL_TYPE, primary_key=True, default=uuid7)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    location: Mapped[str | None] = mapped_column(String(250), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=text("true"), nullable=False
    )


class Vehicle(Base, BaseModelMixin):
    __tablename__ = "vehicles"

    id: Mapped[UUID] = mapped_column(UUID_SQL_TYPE, primary_key=True, default=uuid7)
    number: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    capacity_kg: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)
    driver_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=text("true"), nullable=False
    )


class OrgSettings(Base, BaseModelMixin):
    """Single-row tenant settings (weight-loss thresholds, etc.)."""

    __tablename__ = "org_settings"

    id: Mapped[UUID] = mapped_column(UUID_SQL_TYPE, primary_key=True, default=uuid7)
    weight_loss_warn_pct: Mapped[Decimal] = mapped_column(
        Numeric(8, 2), nullable=False, server_default=text("2.00")
    )
    weight_loss_alert_pct: Mapped[Decimal] = mapped_column(
        Numeric(8, 2), nullable=False, server_default=text("5.00")
    )
    enforce_credit_limit: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=text("true"), nullable=False
    )


class FarmLoad(Base, BaseModelMixin):
    __tablename__ = "farm_loads"

    id: Mapped[UUID] = mapped_column(UUID_SQL_TYPE, primary_key=True, default=uuid7)
    load_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    farm_id: Mapped[UUID | None] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("farms.id"), nullable=True
    )
    vehicle_id: Mapped[UUID | None] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("vehicles.id"), nullable=True
    )
    vehicle_number: Mapped[str | None] = mapped_column(String(40), nullable=True)
    driver_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    driver_user_id: Mapped[UUID | None] = mapped_column(UUID_SQL_TYPE, nullable=True)
    loaded_weight_kg: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    bird_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    remarks: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[FarmLoadStatus] = mapped_column(
        SqlEnum(FarmLoadStatus, name="farm_load_status", native_enum=False),
        nullable=False,
        default=FarmLoadStatus.OPEN,
    )


class DeliveryRun(Base, BaseModelMixin):
    __tablename__ = "delivery_runs"

    id: Mapped[UUID] = mapped_column(UUID_SQL_TYPE, primary_key=True, default=uuid7)
    farm_load_id: Mapped[UUID] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("farm_loads.id"), nullable=False, index=True
    )
    run_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[DeliveryRunStatus] = mapped_column(
        SqlEnum(DeliveryRunStatus, name="delivery_run_status", native_enum=False),
        nullable=False,
        default=DeliveryRunStatus.PLANNED,
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class DeliveryStop(Base, BaseModelMixin):
    __tablename__ = "delivery_stops"

    id: Mapped[UUID] = mapped_column(UUID_SQL_TYPE, primary_key=True, default=uuid7)
    delivery_run_id: Mapped[UUID] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("delivery_runs.id"), nullable=False, index=True
    )
    retailer_id: Mapped[UUID] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("retailers.id"), nullable=False, index=True
    )
    daily_order_id: Mapped[UUID | None] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("retailer_daily_orders.id"), nullable=True
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    ordered_kg: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    delivered_weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)
    rate_per_kg: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    gross_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    status: Mapped[DeliveryStopStatus] = mapped_column(
        SqlEnum(DeliveryStopStatus, name="delivery_stop_status", native_enum=False),
        nullable=False,
        default=DeliveryStopStatus.PENDING,
    )
    weighed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scale_device_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    weight_override_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    delivered_bird_count: Mapped[int | None] = mapped_column(Integer, nullable=True)


class DeliveryBill(Base, BaseModelMixin):
    __tablename__ = "delivery_bills"
    __table_args__ = (
        UniqueConstraint("bill_number", name="uq_delivery_bill_number"),
        UniqueConstraint("checkout_id", name="uq_delivery_bill_checkout"),
    )

    id: Mapped[UUID] = mapped_column(UUID_SQL_TYPE, primary_key=True, default=uuid7)
    bill_number: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    checkout_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    delivery_stop_id: Mapped[UUID] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("delivery_stops.id"), nullable=False, unique=True
    )
    retailer_id: Mapped[UUID] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("retailers.id"), nullable=False, index=True
    )
    bill_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    weight_kg: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    rate_per_kg: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    cash_payment: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, server_default=text("0.00")
    )
    upi_payment: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, server_default=text("0.00")
    )
    balance_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    print_status: Mapped[PrintStatus] = mapped_column(
        SqlEnum(PrintStatus, name="print_status", native_enum=False),
        nullable=False,
        default=PrintStatus.PENDING,
    )
    whatsapp_shared_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class Payment(Base, BaseModelMixin):
    __tablename__ = "payments"

    id: Mapped[UUID] = mapped_column(UUID_SQL_TYPE, primary_key=True, default=uuid7)
    retailer_id: Mapped[UUID] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("retailers.id"), nullable=False, index=True
    )
    delivery_bill_id: Mapped[UUID | None] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("delivery_bills.id"), nullable=True
    )
    payment_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    cash_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, server_default=text("0.00")
    )
    upi_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, server_default=text("0.00")
    )
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    type: Mapped[PaymentType] = mapped_column(
        SqlEnum(PaymentType, name="payment_type", native_enum=False),
        nullable=False,
        default=PaymentType.RECEIVED,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class TripWeightLoss(Base, BaseModelMixin):
    __tablename__ = "trip_weight_losses"
    __table_args__ = (
        UniqueConstraint("delivery_run_id", name="uq_trip_weight_loss_run"),
    )

    id: Mapped[UUID] = mapped_column(UUID_SQL_TYPE, primary_key=True, default=uuid7)
    farm_load_id: Mapped[UUID] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("farm_loads.id"), nullable=False, index=True
    )
    delivery_run_id: Mapped[UUID] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("delivery_runs.id"), nullable=False
    )
    loaded_kg: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    delivered_kg: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    loss_kg: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    loss_pct: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_ist,
        nullable=False,
    )


class BillSequence(Base, BaseModelMixin):
    """Yearly bill number counter: DEL-YYYY-000001."""

    __tablename__ = "bill_sequences"
    __table_args__ = (UniqueConstraint("year", name="uq_bill_sequence_year"),)

    id: Mapped[UUID] = mapped_column(UUID_SQL_TYPE, primary_key=True, default=uuid7)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    last_value: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

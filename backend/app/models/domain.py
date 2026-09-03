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
from sqlalchemy.orm import Mapped, mapped_column, relationship

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


class Item(Base, BaseModelMixin):
    __tablename__ = "items"

    id: Mapped[UUID] = mapped_column(UUID_SQL_TYPE, primary_key=True, default=uuid7)
    name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    uom: Mapped[str] = mapped_column(String(20), nullable=False, server_default="KG")
    default_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, server_default=text("0.00")
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=text("true"), nullable=False
    )


class Route(Base, BaseModelMixin):
    __tablename__ = "routes"

    id: Mapped[UUID] = mapped_column(UUID_SQL_TYPE, primary_key=True, default=uuid7)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    area: Mapped[str | None] = mapped_column(String(120), nullable=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sort_order: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=text("true"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_ist,
        onupdate=now_ist,
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
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
    route_id: Mapped[UUID | None] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("routes.id", ondelete="SET NULL"), nullable=True, index=True
    )
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
    __table_args__ = (
        UniqueConstraint("retailer_id", "item_id", "effective_from", name="uq_retailer_item_rate"),
    )

    id: Mapped[UUID] = mapped_column(UUID_SQL_TYPE, primary_key=True, default=uuid7)
    retailer_id: Mapped[UUID | None] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("retailers.id"), nullable=True, index=True
    )
    item_id: Mapped[UUID] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("items.id"), nullable=False, index=True
    )
    rate_per_kg: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)


class RetailerDailyOrder(Base, BaseModelMixin):
    __tablename__ = "retailer_daily_orders"

    id: Mapped[UUID] = mapped_column(UUID_SQL_TYPE, primary_key=True, default=uuid7)
    order_number: Mapped[str | None] = mapped_column(
        String(32), unique=True, index=True, nullable=True
    )
    retailer_id: Mapped[UUID] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("retailers.id"), nullable=False, index=True
    )
    order_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[OrderStatus] = mapped_column(
        SqlEnum(OrderStatus, name="order_status", native_enum=False),
        nullable=False,
        default=OrderStatus.PLACED,
    )
    expected_delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_by_user_id: Mapped[UUID | None] = mapped_column(UUID_SQL_TYPE, nullable=True)

    items: Mapped[list["RetailerDailyOrderItem"]] = relationship(
        "RetailerDailyOrderItem",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class RetailerDailyOrderItem(Base, BaseModelMixin):
    __tablename__ = "retailer_daily_order_items"
    __table_args__ = (UniqueConstraint("order_id", "item_id", name="uq_retailer_daily_order_item"),)

    id: Mapped[UUID] = mapped_column(UUID_SQL_TYPE, primary_key=True, default=uuid7)
    order_id: Mapped[UUID] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("retailer_daily_orders.id"), nullable=False, index=True
    )
    item_id: Mapped[UUID] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("items.id"), nullable=False, index=True
    )
    requested_kg: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)
    total_boxes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bird_size: Mapped[str | None] = mapped_column(String(50), nullable=True)
    bird_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    locked_rate_per_kg: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)

    item: Mapped["Item"] = relationship("Item", lazy="selectin")


class Farm(Base, BaseModelMixin):
    __tablename__ = "farms"

    id: Mapped[UUID] = mapped_column(UUID_SQL_TYPE, primary_key=True, default=uuid7)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    owner_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    location: Mapped[str | None] = mapped_column(String(250), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)
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
    item_id: Mapped[UUID] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("items.id"), nullable=False, index=True
    )
    vehicle_id: Mapped[UUID | None] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("vehicles.id"), nullable=True
    )
    vehicle_number: Mapped[str | None] = mapped_column(String(40), nullable=True)
    driver_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    driver_user_id: Mapped[UUID | None] = mapped_column(UUID_SQL_TYPE, nullable=True)
    loaded_weight_kg: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    bird_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_boxes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    empty_box_weight: Mapped[Decimal | None] = mapped_column(Numeric(8, 3), nullable=True)
    weight_loss_kg: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)
    rate_per_kg: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    total_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    paid_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    payment_method: Mapped[str | None] = mapped_column(String(50), nullable=True)
    remarks: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[FarmLoadStatus] = mapped_column(
        SqlEnum(FarmLoadStatus, name="farm_load_status", native_enum=False),
        nullable=False,
        default=FarmLoadStatus.OPEN,
    )


class DeliveryRun(Base, BaseModelMixin):
    __tablename__ = "delivery_runs"

    id: Mapped[UUID] = mapped_column(UUID_SQL_TYPE, primary_key=True, default=uuid7)
    farm_load_id: Mapped[UUID | None] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("farm_loads.id"), nullable=True, index=True
    )
    run_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[DeliveryRunStatus] = mapped_column(
        SqlEnum(DeliveryRunStatus, name="delivery_run_status", native_enum=False),
        nullable=False,
        default=DeliveryRunStatus.PLANNED,
    )
    driver_user_id: Mapped[UUID | None] = mapped_column(UUID_SQL_TYPE, nullable=True)
    driver_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    vehicle_id: Mapped[UUID | None] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("vehicles.id"), nullable=True
    )
    vehicle_number: Mapped[str | None] = mapped_column(String(40), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class DeliveryStop(Base, BaseModelMixin):
    __tablename__ = "delivery_stops"
    __table_args__ = (
        UniqueConstraint("delivery_run_id", "retailer_id", name="uq_delivery_stop_run_retailer"),
    )

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
    status: Mapped[DeliveryStopStatus] = mapped_column(
        SqlEnum(DeliveryStopStatus, name="delivery_stop_status", native_enum=False),
        nullable=False,
        default=DeliveryStopStatus.PENDING,
    )
    weighed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scale_device_id: Mapped[str | None] = mapped_column(String(120), nullable=True)

    items: Mapped[list["DeliveryStopItem"]] = relationship(
        "DeliveryStopItem",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class DeliveryStopItem(Base, BaseModelMixin):
    __tablename__ = "delivery_stop_items"
    __table_args__ = (
        UniqueConstraint("delivery_stop_id", "item_id", name="uq_delivery_stop_item"),
    )

    id: Mapped[UUID] = mapped_column(UUID_SQL_TYPE, primary_key=True, default=uuid7)
    delivery_stop_id: Mapped[UUID] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("delivery_stops.id"), nullable=False, index=True
    )
    item_id: Mapped[UUID] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("items.id"), nullable=False, index=True
    )
    ordered_kg: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    delivered_weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)
    delivered_boxes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    gross_weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)
    empty_box_weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)
    rate_per_kg: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    gross_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    delivered_bird_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    weight_override_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)


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

    items: Mapped[list["DeliveryBillItem"]] = relationship(
        "DeliveryBillItem",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class DeliveryBillItem(Base, BaseModelMixin):
    __tablename__ = "delivery_bill_items"
    __table_args__ = (
        UniqueConstraint("delivery_bill_id", "item_id", name="uq_delivery_bill_item"),
    )

    id: Mapped[UUID] = mapped_column(UUID_SQL_TYPE, primary_key=True, default=uuid7)
    delivery_bill_id: Mapped[UUID] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("delivery_bills.id"), nullable=False, index=True
    )
    item_id: Mapped[UUID] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("items.id"), nullable=False, index=True
    )
    weight_kg: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    rate_per_kg: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    box_charge: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, server_default=text("0.00")
    )


class RetailerReturn(Base, BaseModelMixin):
    __tablename__ = "retailer_returns"

    id: Mapped[UUID] = mapped_column(UUID_SQL_TYPE, primary_key=True, default=uuid7)
    retailer_id: Mapped[UUID] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("retailers.id"), nullable=False, index=True
    )
    delivery_bill_id: Mapped[UUID | None] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("delivery_bills.id"), nullable=True
    )
    item_id: Mapped[UUID | None] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("items.id"), nullable=True, index=True
    )
    return_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    weight_kg: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    bird_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rate_per_kg: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)


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
    is_credit: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=text("true"), nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class TripWeightLoss(Base, BaseModelMixin):
    __tablename__ = "trip_weight_losses"
    __table_args__ = (UniqueConstraint("delivery_run_id", name="uq_trip_weight_loss_run"),)

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


class OrderSequence(Base, BaseModelMixin):
    """Yearly order number counter: ORD-YY-000000."""

    __tablename__ = "order_sequences"
    __table_args__ = (UniqueConstraint("year", name="uq_order_sequence_year"),)

    id: Mapped[UUID] = mapped_column(UUID_SQL_TYPE, primary_key=True, default=uuid7)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    last_value: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))


class ExpenseCategory(Base, BaseModelMixin):
    __tablename__ = "expense_categories"

    id: Mapped[UUID] = mapped_column(UUID_SQL_TYPE, primary_key=True, default=uuid7)
    name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=text("true"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_ist,
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_ist,
        onupdate=now_ist,
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )


class Expense(Base, BaseModelMixin):
    __tablename__ = "expenses"

    id: Mapped[UUID] = mapped_column(UUID_SQL_TYPE, primary_key=True, default=uuid7)
    category_id: Mapped[UUID] = mapped_column(
        UUID_SQL_TYPE, ForeignKey("expense_categories.id"), nullable=False, index=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    expense_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    payment_method: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[UUID | None] = mapped_column(UUID_SQL_TYPE, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_ist,
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_ist,
        onupdate=now_ist,
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )

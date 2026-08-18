from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import (
    DeliveryRunStatus,
    DeliveryStopStatus,
    FarmLoadStatus,
    OrderStatus,
    PaymentType,
    PrintStatus,
    UserRole,
)
from app.schemas.dates import IstDate, IstDateOptional, IstDateTime


class LoginRequest(BaseModel):
    username: str
    password: str
    organization_slug: str | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    role: UserRole
    organization_id: UUID | None = None
    retailer_id: UUID | None = None
    is_active: bool
    organization_slug: str | None = None
    organization_name: str | None = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class RetailerCreate(BaseModel):
    name: str
    shop_name: str | None = None
    owner_name: str | None = None
    phone: str | None = None
    alternate_phone: str | None = None
    whatsapp: str | None = None
    address: str | None = None
    area: str | None = None
    route_name: str | None = None
    category: str | None = None
    notes: str | None = None
    opening_balance: Decimal = Decimal("0.00")
    credit_limit: Decimal = Decimal("0.00")
    preferred_delivery_time: str | None = None
    username: str | None = None
    password: str | None = None


class RetailerUpdate(BaseModel):
    name: str | None = None
    shop_name: str | None = None
    owner_name: str | None = None
    phone: str | None = None
    alternate_phone: str | None = None
    whatsapp: str | None = None
    address: str | None = None
    area: str | None = None
    route_name: str | None = None
    category: str | None = None
    notes: str | None = None
    is_active: bool | None = None
    opening_balance: Decimal | None = None
    credit_limit: Decimal | None = None
    preferred_delivery_time: str | None = None


class RetailerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    shop_name: str | None
    owner_name: str | None = None
    phone: str | None
    alternate_phone: str | None
    whatsapp: str | None = None
    address: str | None
    area: str | None = None
    route_name: str | None = None
    category: str | None = None
    notes: str | None
    is_active: bool
    opening_balance: Decimal
    credit_balance: Decimal
    credit_limit: Decimal = Decimal("0.00")
    preferred_delivery_time: str | None = None

class RateUpsert(BaseModel):
    retailer_id: UUID | None = None
    rate_per_kg: Decimal
    effective_from: IstDateOptional = None
    effective_to: IstDateOptional = None


class RateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    retailer_id: UUID | None
    rate_per_kg: Decimal
    effective_from: IstDate
    effective_to: IstDateOptional = None


class DailyOrderCreate(BaseModel):
    requested_kg: Decimal = Field(gt=0)
    bird_size: str | None = None
    notes: str | None = None


class DailyOrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    retailer_id: UUID
    order_date: IstDate
    requested_kg: Decimal
    bird_size: str | None = None
    notes: str | None
    status: OrderStatus
    retailer_name: str | None = None
    shop_name: str | None = None


class TodayOrdersResponse(BaseModel):
    items: list[DailyOrderOut]
    total_requested_kg: Decimal
    has_more: bool = False
    next_cursor: str | None = None


class FarmCreate(BaseModel):
    name: str
    owner_name: str | None = None
    location: str | None = None
    address: str | None = None
    contact_phone: str | None = None
    capacity: int | None = None


class FarmOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    owner_name: str | None = None
    location: str | None
    address: str | None = None
    contact_phone: str | None
    capacity: int | None = None
    is_active: bool


class FarmLoadCreate(BaseModel):
    load_date: IstDateOptional = None
    farm_id: UUID | None = None
    vehicle_id: UUID | None = None
    vehicle_number: str | None = None
    driver_name: str | None = None
    driver_user_id: UUID | None = None
    loaded_weight_kg: Decimal = Field(gt=0)
    bird_count: int | None = None
    rate_per_kg: Decimal | None = None
    total_amount: Decimal | None = None
    paid_amount: Decimal | None = None
    payment_method: str | None = None
    remarks: str | None = None


class FarmLoadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    load_date: IstDate
    farm_id: UUID | None
    vehicle_id: UUID | None = None
    vehicle_number: str | None
    driver_name: str | None
    loaded_weight_kg: Decimal
    bird_count: int | None
    rate_per_kg: Decimal | None = None
    total_amount: Decimal | None = None
    paid_amount: Decimal | None = None
    payment_method: str | None = None
    remarks: str | None
    status: FarmLoadStatus


class VehicleCreate(BaseModel):
    number: str
    capacity_kg: Decimal | None = None
    driver_name: str | None = None


class VehicleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    number: str
    capacity_kg: Decimal | None
    driver_name: str | None
    is_active: bool


class DeliveryRunCreate(BaseModel):
    farm_load_id: UUID
    order_ids: list[UUID]
    run_date: IstDateOptional = None


class DeliveryStopOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    delivery_run_id: UUID
    retailer_id: UUID
    daily_order_id: UUID | None
    sequence: int
    ordered_kg: Decimal
    delivered_weight_kg: Decimal | None
    rate_per_kg: Decimal
    gross_amount: Decimal | None
    status: DeliveryStopStatus
    delivered_bird_count: int | None = None
    retailer_name: str | None = None
    shop_name: str | None = None


class DeliveryRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    farm_load_id: UUID
    run_date: IstDate
    status: DeliveryRunStatus
    started_at: IstDateTime | None = None
    completed_at: IstDateTime | None = None
    stops: list[DeliveryStopOut] = []


class WeighRequest(BaseModel):
    delivered_weight_kg: Decimal = Field(gt=0)
    scale_device_id: str | None = None
    weight_override_reason: str | None = None
    delivered_bird_count: int | None = None


class BillPreviewRequest(BaseModel):
    cash_payment: Decimal = Decimal("0.00")
    upi_payment: Decimal = Decimal("0.00")


class BillPreviewOut(BaseModel):
    stop_id: UUID
    retailer_id: UUID
    weight_kg: Decimal
    rate_per_kg: Decimal
    total_amount: Decimal
    cash_payment: Decimal
    upi_payment: Decimal
    balance_amount: Decimal


class BillCommitRequest(BaseModel):
    cash_payment: Decimal = Decimal("0.00")
    upi_payment: Decimal = Decimal("0.00")
    print_status: PrintStatus = PrintStatus.PENDING
    checkout_id: str | None = None


class DeliveryBillOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    bill_number: str
    checkout_id: str
    delivery_stop_id: UUID
    retailer_id: UUID
    bill_date: IstDate
    weight_kg: Decimal
    rate_per_kg: Decimal
    total_amount: Decimal
    cash_payment: Decimal
    upi_payment: Decimal
    balance_amount: Decimal
    print_status: PrintStatus
    whatsapp_shared_at: IstDateTime | None = None


class PrintStatusUpdate(BaseModel):
    print_status: PrintStatus


class OpsDashboard(BaseModel):
    order_count: int
    ordered_kg: Decimal
    loaded_kg: Decimal
    delivered_kg: Decimal
    pending_kg: Decimal
    total_sales: Decimal
    total_collection: Decimal
    outstanding: Decimal
    loss_kg: Decimal
    loss_pct: Decimal
    loss_status: str  # OK | WARN | ALERT
    retailer_count: int
    completed_deliveries: int
    pending_deliveries: int
    skipped_deliveries: int
    weight_loss_warn_pct: Decimal
    weight_loss_alert_pct: Decimal

class PaymentCreate(BaseModel):
    cash_amount: Decimal = Decimal("0.00")
    upi_amount: Decimal = Decimal("0.00")
    payment_date: IstDateOptional = None
    notes: str | None = None
    type: PaymentType = PaymentType.RECEIVED


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    retailer_id: UUID
    delivery_bill_id: UUID | None
    payment_date: IstDate
    cash_amount: Decimal
    upi_amount: Decimal
    total_amount: Decimal
    type: PaymentType
    notes: str | None


class LedgerEntry(BaseModel):
    entry_type: str
    entry_date: IstDate
    reference: str | None = None
    debit: Decimal = Decimal("0.00")
    credit: Decimal = Decimal("0.00")
    balance_after: Decimal | None = None
    notes: str | None = None


class LedgerOut(BaseModel):
    retailer: RetailerOut
    opening_balance: Decimal
    credit_balance: Decimal
    entries: list[LedgerEntry]


class TripWeightLossOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    farm_load_id: UUID
    delivery_run_id: UUID
    loaded_kg: Decimal
    delivered_kg: Decimal
    loss_kg: Decimal
    loss_pct: Decimal
    computed_at: IstDateTime


class ReportSummary(BaseModel):
    period_start: IstDate
    period_end: IstDate
    total_ordered_kg: Decimal
    total_delivered_kg: Decimal
    total_sales_amount: Decimal
    total_collections: Decimal
    total_loss_kg: Decimal


class OrganizationCreate(BaseModel):
    name: str
    slug: str



class OrganizationUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None


class TenantAdminCreate(BaseModel):
    username: str
    password: str

class DeliveryUserCreate(BaseModel):
    username: str
    password: str
    full_name: str | None = None
    mobile_number: str | None = None


class TenantAdminUpdate(BaseModel):
    is_active: bool | None = None
    password: str | None = None


class OrganizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str
    schema_name: str
    is_active: bool


class CursorPage(BaseModel):
    items: list
    has_more: bool = False
    next_cursor: str | None = None

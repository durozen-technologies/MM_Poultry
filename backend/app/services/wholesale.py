from __future__ import annotations

from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.core.timezone import now_ist, today_ist
from app.models.domain import (
    BillSequence,
    DeliveryBill,
    DeliveryRun,
    DeliveryStop,
    Farm,
    FarmLoad,
    OrgSettings,
    Payment,
    Retailer,
    RetailerDailyOrder,
    RetailerItemRate,
    TripWeightLoss,
    Vehicle,
)
from app.models.enums import (
    DeliveryRunStatus,
    DeliveryStopStatus,
    FarmLoadStatus,
    OrderStatus,
    PaymentType,
    PrintStatus,
    UserRole,
)
from app.models.organization import Organization
from app.models.user import User
from app.schemas import (
    BillCommitRequest,
    BillPreviewOut,
    BillPreviewRequest,
    DailyOrderCreate,
    DailyOrderOut,
    DeliveryBillOut,
    DeliveryRunCreate,
    DeliveryRunOut,
    DeliveryStopOut,
    FarmCreate,
    FarmLoadCreate,
    FarmLoadOut,
    FarmOut,
    LedgerEntry,
    LedgerOut,
    OrganizationCreate,
    OrganizationOut,
    PaymentCreate,
    PaymentOut,
    RateOut,
    OpsDashboard,
    PrintStatusUpdate,
    RateUpsert,
    ReportSummary,
    RetailerCreate,
    RetailerOut,
    RetailerUpdate,
    TodayOrdersResponse,
    TripWeightLossOut,
    VehicleCreate,
    VehicleOut,
    WeighRequest,
)
from app.services.auth import upsert_auth_index

ZERO = Decimal("0.00")
KG_Q = Decimal("0.001")
MONEY_Q = Decimal("0.01")


def q_money(value: Decimal) -> Decimal:
    return value.quantize(MONEY_Q, rounding=ROUND_HALF_UP)


def q_kg(value: Decimal) -> Decimal:
    return value.quantize(KG_Q, rounding=ROUND_HALF_UP)


# --- Organizations ---


async def create_organization(db: AsyncSession, payload: OrganizationCreate) -> OrganizationOut:
    from app.db.tenant_schema import derive_schema_name, provision_tenant_schema_async

    slug = payload.slug.strip().lower()
    existing = await db.scalar(select(Organization).where(Organization.slug == slug))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Organization slug exists")
    schema_name = derive_schema_name(slug)
    org = Organization(name=payload.name.strip(), slug=slug, schema_name=schema_name)
    db.add(org)
    await db.flush()
    await provision_tenant_schema_async(schema_name)
    return OrganizationOut.model_validate(org, from_attributes=True)


async def list_organizations(db: AsyncSession) -> list[OrganizationOut]:
    rows = list(await db.scalars(select(Organization).order_by(Organization.name)))
    return [OrganizationOut.model_validate(r, from_attributes=True) for r in rows]


# --- Rates ---


async def resolve_rate(
    db: AsyncSession, retailer_id: UUID, on_date: date | None = None
) -> Decimal:
    day = on_date or today_ist()
    retailer_rate = await db.scalar(
        select(RetailerItemRate)
        .where(
            RetailerItemRate.retailer_id == retailer_id,
            RetailerItemRate.effective_from <= day,
            (RetailerItemRate.effective_to.is_(None)) | (RetailerItemRate.effective_to >= day),
        )
        .order_by(RetailerItemRate.effective_from.desc())
        .limit(1)
    )
    if retailer_rate:
        return retailer_rate.rate_per_kg
    default_rate = await db.scalar(
        select(RetailerItemRate)
        .where(
            RetailerItemRate.retailer_id.is_(None),
            RetailerItemRate.effective_from <= day,
            (RetailerItemRate.effective_to.is_(None)) | (RetailerItemRate.effective_to >= day),
        )
        .order_by(RetailerItemRate.effective_from.desc())
        .limit(1)
    )
    if default_rate:
        return default_rate.rate_per_kg
    return Decimal("0.00")


async def upsert_rate(db: AsyncSession, payload: RateUpsert) -> RateOut:
    day = payload.effective_from or today_ist()
    row = RetailerItemRate(
        retailer_id=payload.retailer_id,
        rate_per_kg=q_money(payload.rate_per_kg),
        effective_from=day,
        effective_to=payload.effective_to,
    )
    db.add(row)
    await db.flush()
    return RateOut.model_validate(row, from_attributes=True)


async def list_rates(db: AsyncSession) -> list[RateOut]:
    rows = list(
        await db.scalars(select(RetailerItemRate).order_by(RetailerItemRate.effective_from.desc()))
    )
    return [RateOut.model_validate(r, from_attributes=True) for r in rows]


# --- Retailers ---


async def create_retailer(
    db: AsyncSession,
    payload: RetailerCreate,
    *,
    organization_id: UUID,
    schema_name: str,
) -> RetailerOut:
    retailer = Retailer(
        name=payload.name.strip(),
        shop_name=payload.shop_name,
        owner_name=payload.owner_name,
        phone=payload.phone,
        alternate_phone=payload.alternate_phone,
        whatsapp=payload.whatsapp,
        address=payload.address,
        area=payload.area,
        route_name=payload.route_name,
        category=payload.category,
        notes=payload.notes,
        opening_balance=q_money(payload.opening_balance),
        credit_balance=q_money(payload.opening_balance),
        credit_limit=q_money(payload.credit_limit),
        preferred_delivery_time=payload.preferred_delivery_time,
    )
    db.add(retailer)
    await db.flush()

    if payload.username and payload.password:
        user = User(
            username=payload.username.strip(),
            password_hash=get_password_hash(payload.password),
            role=UserRole.RETAILER,
            organization_id=organization_id,
            retailer_id=retailer.id,
        )
        db.add(user)
        await db.flush()
        await upsert_auth_index(
            db,
            username=user.username,
            organization_id=organization_id,
            schema_name=schema_name,
            user_id=user.id,
        )
    return RetailerOut.model_validate(retailer, from_attributes=True)


async def list_retailers(
    db: AsyncSession, *, cursor: str | None = None, limit: int = 50
) -> tuple[list[RetailerOut], bool, str | None]:
    stmt = select(Retailer).order_by(Retailer.created_at.desc(), Retailer.id.desc()).limit(limit + 1)
    if cursor:
        stmt = stmt.where(Retailer.id < UUID(cursor))
    rows = list(await db.scalars(stmt))
    has_more = len(rows) > limit
    rows = rows[:limit]
    next_cursor = str(rows[-1].id) if has_more and rows else None
    return (
        [RetailerOut.model_validate(r, from_attributes=True) for r in rows],
        has_more,
        next_cursor,
    )


async def get_retailer(db: AsyncSession, retailer_id: UUID) -> Retailer:
    retailer = await db.scalar(select(Retailer).where(Retailer.id == retailer_id))
    if retailer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retailer not found")
    return retailer


async def update_retailer(
    db: AsyncSession, retailer_id: UUID, payload: RetailerUpdate
) -> RetailerOut:
    retailer = await get_retailer(db, retailer_id)
    data = payload.model_dump(exclude_unset=True)
    if "opening_balance" in data and data["opening_balance"] is not None:
        # Adjust credit by delta of opening balance change
        old_opening = retailer.opening_balance
        new_opening = q_money(data["opening_balance"])
        retailer.credit_balance = q_money(retailer.credit_balance + (new_opening - old_opening))
        retailer.opening_balance = new_opening
        del data["opening_balance"]
    for key, value in data.items():
        setattr(retailer, key, value)
    await db.flush()
    return RetailerOut.model_validate(retailer, from_attributes=True)


# --- Orders ---


async def upsert_today_order(
    db: AsyncSession,
    *,
    retailer_id: UUID,
    payload: DailyOrderCreate,
    user_id: UUID | None,
) -> DailyOrderOut:
    day = today_ist()
    existing = await db.scalar(
        select(RetailerDailyOrder).where(
            RetailerDailyOrder.retailer_id == retailer_id,
            RetailerDailyOrder.order_date == day,
        )
    )
    if existing:
        if existing.status == OrderStatus.CANCELLED:
            existing.status = OrderStatus.PLACED
        existing.requested_kg = q_kg(payload.requested_kg)
        existing.notes = payload.notes
        order = existing
    else:
        order = RetailerDailyOrder(
            retailer_id=retailer_id,
            order_date=day,
            requested_kg=q_kg(payload.requested_kg),
            notes=payload.notes,
            status=OrderStatus.PLACED,
            created_by_user_id=user_id,
        )
        db.add(order)
    await db.flush()
    retailer = await get_retailer(db, retailer_id)
    out = DailyOrderOut.model_validate(order, from_attributes=True)
    out.retailer_name = retailer.name
    out.shop_name = retailer.shop_name
    return out


async def get_today_order_for_retailer(
    db: AsyncSession, retailer_id: UUID
) -> DailyOrderOut | None:
    day = today_ist()
    order = await db.scalar(
        select(RetailerDailyOrder).where(
            RetailerDailyOrder.retailer_id == retailer_id,
            RetailerDailyOrder.order_date == day,
        )
    )
    if order is None:
        return None
    retailer = await get_retailer(db, retailer_id)
    out = DailyOrderOut.model_validate(order, from_attributes=True)
    out.retailer_name = retailer.name
    out.shop_name = retailer.shop_name
    return out


async def list_today_orders(db: AsyncSession) -> TodayOrdersResponse:
    day = today_ist()
    orders = list(
        await db.scalars(
            select(RetailerDailyOrder)
            .where(
                RetailerDailyOrder.order_date == day,
                RetailerDailyOrder.status != OrderStatus.CANCELLED,
            )
            .order_by(RetailerDailyOrder.created_at.asc())
        )
    )
    items: list[DailyOrderOut] = []
    total = Decimal("0.000")
    for order in orders:
        retailer = await get_retailer(db, order.retailer_id)
        out = DailyOrderOut.model_validate(order, from_attributes=True)
        out.retailer_name = retailer.name
        out.shop_name = retailer.shop_name
        items.append(out)
        total += order.requested_kg
    return TodayOrdersResponse(items=items, total_requested_kg=q_kg(total))


# --- Farms / loads ---


async def create_farm(db: AsyncSession, payload: FarmCreate) -> FarmOut:
    farm = Farm(name=payload.name.strip(), location=payload.location, contact_phone=payload.contact_phone)
    db.add(farm)
    await db.flush()
    return FarmOut.model_validate(farm, from_attributes=True)


async def list_farms(db: AsyncSession) -> list[FarmOut]:
    rows = list(await db.scalars(select(Farm).where(Farm.is_active.is_(True)).order_by(Farm.name)))
    return [FarmOut.model_validate(r, from_attributes=True) for r in rows]


async def create_vehicle(db: AsyncSession, payload: VehicleCreate) -> VehicleOut:
    vehicle = Vehicle(
        number=payload.number.strip().upper(),
        capacity_kg=q_kg(payload.capacity_kg) if payload.capacity_kg is not None else None,
        driver_name=payload.driver_name,
    )
    db.add(vehicle)
    await db.flush()
    return VehicleOut.model_validate(vehicle, from_attributes=True)


async def list_vehicles(db: AsyncSession) -> list[VehicleOut]:
    rows = list(
        await db.scalars(select(Vehicle).where(Vehicle.is_active.is_(True)).order_by(Vehicle.number))
    )
    return [VehicleOut.model_validate(r, from_attributes=True) for r in rows]


async def _get_org_settings(db: AsyncSession) -> OrgSettings:
    settings = await db.scalar(select(OrgSettings).limit(1))
    if settings is None:
        settings = OrgSettings()
        db.add(settings)
        await db.flush()
    return settings


async def create_farm_load(db: AsyncSession, payload: FarmLoadCreate) -> FarmLoadOut:
    vehicle_number = payload.vehicle_number
    driver_name = payload.driver_name
    if payload.vehicle_id:
        vehicle = await db.scalar(select(Vehicle).where(Vehicle.id == payload.vehicle_id))
        if vehicle is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
        vehicle_number = vehicle_number or vehicle.number
        driver_name = driver_name or vehicle.driver_name
    load = FarmLoad(
        load_date=payload.load_date or today_ist(),
        farm_id=payload.farm_id,
        vehicle_id=payload.vehicle_id,
        vehicle_number=vehicle_number,
        driver_name=driver_name,
        driver_user_id=payload.driver_user_id,
        loaded_weight_kg=q_kg(payload.loaded_weight_kg),
        bird_count=payload.bird_count,
        remarks=payload.remarks,
        status=FarmLoadStatus.OPEN,
    )
    db.add(load)
    await db.flush()
    return FarmLoadOut.model_validate(load, from_attributes=True)


async def list_farm_loads(db: AsyncSession) -> list[FarmLoadOut]:
    rows = list(
        await db.scalars(select(FarmLoad).order_by(FarmLoad.load_date.desc(), FarmLoad.created_at.desc()))
    )
    return [FarmLoadOut.model_validate(r, from_attributes=True) for r in rows]


async def update_farm_load(
    db: AsyncSession, load_id: UUID, payload: FarmLoadCreate
) -> FarmLoadOut:
    load = await db.scalar(select(FarmLoad).where(FarmLoad.id == load_id))
    if load is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm load not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        if key == "loaded_weight_kg" and value is not None:
            setattr(load, key, q_kg(value))
        elif key == "load_date" and value is None:
            continue
        else:
            setattr(load, key, value)
    await db.flush()
    return FarmLoadOut.model_validate(load, from_attributes=True)


# --- Delivery runs ---


async def _stop_out(db: AsyncSession, stop: DeliveryStop) -> DeliveryStopOut:
    retailer = await get_retailer(db, stop.retailer_id)
    out = DeliveryStopOut.model_validate(stop, from_attributes=True)
    out.retailer_name = retailer.name
    out.shop_name = retailer.shop_name
    return out


async def create_delivery_run(db: AsyncSession, payload: DeliveryRunCreate) -> DeliveryRunOut:
    load = await db.scalar(select(FarmLoad).where(FarmLoad.id == payload.farm_load_id))
    if load is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm load not found")
    if not payload.order_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="order_ids required")

    run = DeliveryRun(
        farm_load_id=load.id,
        run_date=payload.run_date or today_ist(),
        status=DeliveryRunStatus.PLANNED,
    )
    db.add(run)
    await db.flush()

    for idx, order_id in enumerate(payload.order_ids, start=1):
        order = await db.scalar(select(RetailerDailyOrder).where(RetailerDailyOrder.id == order_id))
        if order is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
        rate = await resolve_rate(db, order.retailer_id, run.run_date)
        stop = DeliveryStop(
            delivery_run_id=run.id,
            retailer_id=order.retailer_id,
            daily_order_id=order.id,
            sequence=idx,
            ordered_kg=order.requested_kg,
            rate_per_kg=rate,
            status=DeliveryStopStatus.PENDING,
        )
        db.add(stop)
        order.status = OrderStatus.ACKNOWLEDGED

    load.status = FarmLoadStatus.IN_TRANSIT
    await db.flush()
    return await get_delivery_run(db, run.id)


async def get_delivery_run(db: AsyncSession, run_id: UUID) -> DeliveryRunOut:
    run = await db.scalar(select(DeliveryRun).where(DeliveryRun.id == run_id))
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery run not found")
    stops = list(
        await db.scalars(
            select(DeliveryStop)
            .where(DeliveryStop.delivery_run_id == run.id)
            .order_by(DeliveryStop.sequence.asc())
        )
    )
    out = DeliveryRunOut.model_validate(run, from_attributes=True)
    out.stops = [await _stop_out(db, s) for s in stops]
    return out


async def get_active_run(db: AsyncSession) -> DeliveryRunOut | None:
    run = await db.scalar(
        select(DeliveryRun)
        .where(
            DeliveryRun.status.in_(
                [DeliveryRunStatus.PLANNED, DeliveryRunStatus.IN_PROGRESS]
            )
        )
        .order_by(DeliveryRun.created_at.desc())
        .limit(1)
    )
    if run is None:
        return None
    return await get_delivery_run(db, run.id)


async def start_delivery_run(db: AsyncSession, run_id: UUID) -> DeliveryRunOut:
    run = await db.scalar(select(DeliveryRun).where(DeliveryRun.id == run_id))
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery run not found")
    run.status = DeliveryRunStatus.IN_PROGRESS
    run.started_at = now_ist()
    await db.flush()
    return await get_delivery_run(db, run.id)


async def skip_stop(db: AsyncSession, stop_id: UUID) -> DeliveryStopOut:
    stop = await db.scalar(select(DeliveryStop).where(DeliveryStop.id == stop_id))
    if stop is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stop not found")
    if stop.status == DeliveryStopStatus.BILLED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Stop already billed")
    stop.status = DeliveryStopStatus.SKIPPED
    await db.flush()
    return await _stop_out(db, stop)


# --- Weigh / bill ---


async def weigh_stop(
    db: AsyncSession,
    stop_id: UUID,
    payload: WeighRequest,
    *,
    actor_role: UserRole,
) -> DeliveryStopOut:
    stop = await db.scalar(select(DeliveryStop).where(DeliveryStop.id == stop_id))
    if stop is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stop not found")
    if stop.status in {DeliveryStopStatus.BILLED, DeliveryStopStatus.SKIPPED}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Stop not weighable")
    if payload.weight_override_reason and actor_role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin may override weight with reason",
        )
    stop.delivered_weight_kg = q_kg(payload.delivered_weight_kg)
    stop.scale_device_id = payload.scale_device_id
    stop.weight_override_reason = payload.weight_override_reason
    stop.delivered_bird_count = payload.delivered_bird_count
    stop.gross_amount = q_money(stop.delivered_weight_kg * stop.rate_per_kg)
    stop.status = DeliveryStopStatus.WEIGHED
    stop.weighed_at = now_ist()
    await db.flush()
    return await _stop_out(db, stop)


def _preview_from_stop(
    stop: DeliveryStop, payload: BillPreviewRequest
) -> BillPreviewOut:
    if stop.delivered_weight_kg is None or stop.gross_amount is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stop not weighed")
    cash = q_money(payload.cash_payment)
    upi = q_money(payload.upi_payment)
    total = q_money(stop.gross_amount)
    balance = q_money(total - cash - upi)
    if balance < ZERO:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payments exceed bill total",
        )
    return BillPreviewOut(
        stop_id=stop.id,
        retailer_id=stop.retailer_id,
        weight_kg=stop.delivered_weight_kg,
        rate_per_kg=stop.rate_per_kg,
        total_amount=total,
        cash_payment=cash,
        upi_payment=upi,
        balance_amount=balance,
    )


async def preview_bill(
    db: AsyncSession, stop_id: UUID, payload: BillPreviewRequest
) -> BillPreviewOut:
    stop = await db.scalar(select(DeliveryStop).where(DeliveryStop.id == stop_id))
    if stop is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stop not found")
    if stop.status != DeliveryStopStatus.WEIGHED and stop.status != DeliveryStopStatus.BILLED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stop not weighed")
    return _preview_from_stop(stop, payload)


async def _next_bill_number(db: AsyncSession, bill_date: date) -> str:
    year = bill_date.year
    seq = await db.scalar(select(BillSequence).where(BillSequence.year == year))
    if seq is None:
        seq = BillSequence(year=year, last_value=0)
        db.add(seq)
        await db.flush()
    seq.last_value += 1
    await db.flush()
    return f"DEL-{year}-{seq.last_value:06d}"


async def commit_bill(
    db: AsyncSession, stop_id: UUID, payload: BillCommitRequest
) -> DeliveryBillOut:
    """Persist bill first (PRINT_PENDING allowed), then client prints and PATCHes status.

    checkout_id makes retries idempotent across network blips.
    """
    stop = await db.scalar(select(DeliveryStop).where(DeliveryStop.id == stop_id))
    if stop is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stop not found")

    checkout_id = (payload.checkout_id or "").strip() or str(uuid4())

    by_checkout = await db.scalar(
        select(DeliveryBill).where(DeliveryBill.checkout_id == checkout_id)
    )
    if by_checkout:
        return DeliveryBillOut.model_validate(by_checkout, from_attributes=True)

    existing = await db.scalar(
        select(DeliveryBill).where(DeliveryBill.delivery_stop_id == stop_id)
    )
    if existing:
        return DeliveryBillOut.model_validate(existing, from_attributes=True)

    if stop.status != DeliveryStopStatus.WEIGHED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stop must be weighed before commit",
        )

    preview = _preview_from_stop(
        stop, BillPreviewRequest(cash_payment=payload.cash_payment, upi_payment=payload.upi_payment)
    )
    retailer = await get_retailer(db, stop.retailer_id)
    settings = await _get_org_settings(db)
    if (
        settings.enforce_credit_limit
        and retailer.credit_limit > ZERO
        and q_money(retailer.credit_balance + preview.balance_amount) > retailer.credit_limit
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Credit limit exceeded (limit ₹{retailer.credit_limit}, "
                f"would be ₹{q_money(retailer.credit_balance + preview.balance_amount)})"
            ),
        )

    bill_date = today_ist()
    bill_number = await _next_bill_number(db, bill_date)
    print_status = payload.print_status or PrintStatus.PENDING
    bill = DeliveryBill(
        bill_number=bill_number,
        checkout_id=checkout_id,
        delivery_stop_id=stop.id,
        retailer_id=stop.retailer_id,
        bill_date=bill_date,
        weight_kg=preview.weight_kg,
        rate_per_kg=preview.rate_per_kg,
        total_amount=preview.total_amount,
        cash_payment=preview.cash_payment,
        upi_payment=preview.upi_payment,
        balance_amount=preview.balance_amount,
        print_status=print_status,
    )
    db.add(bill)

    retailer.credit_balance = q_money(retailer.credit_balance + preview.balance_amount)

    collected = preview.cash_payment + preview.upi_payment
    if collected > ZERO:
        db.add(
            Payment(
                retailer_id=stop.retailer_id,
                delivery_bill_id=None,  # set after flush
                payment_date=bill_date,
                cash_amount=preview.cash_payment,
                upi_amount=preview.upi_payment,
                total_amount=q_money(collected),
                type=PaymentType.RECEIVED,
                notes=f"Collected on bill {bill_number}",
            )
        )

    stop.status = DeliveryStopStatus.BILLED
    if stop.daily_order_id:
        order = await db.scalar(
            select(RetailerDailyOrder).where(RetailerDailyOrder.id == stop.daily_order_id)
        )
        if order:
            order.status = OrderStatus.FULFILLED

    await db.flush()

    payment = await db.scalar(
        select(Payment).where(
            Payment.retailer_id == stop.retailer_id,
            Payment.notes == f"Collected on bill {bill_number}",
        )
    )
    if payment:
        payment.delivery_bill_id = bill.id

    await db.flush()
    return DeliveryBillOut.model_validate(bill, from_attributes=True)


async def update_bill_print_status(
    db: AsyncSession, bill_id: UUID, payload: PrintStatusUpdate
) -> DeliveryBillOut:
    bill = await db.scalar(select(DeliveryBill).where(DeliveryBill.id == bill_id))
    if bill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found")
    bill.print_status = payload.print_status
    await db.flush()
    return DeliveryBillOut.model_validate(bill, from_attributes=True)


async def ops_dashboard(db: AsyncSession, on_date: date | None = None) -> OpsDashboard:
    day = on_date or today_ist()
    settings = await _get_org_settings(db)

    order_rows = list(
        await db.scalars(
            select(RetailerDailyOrder).where(RetailerDailyOrder.order_date == day)
        )
    )
    ordered_kg = q_kg(sum((o.requested_kg for o in order_rows), ZERO))

    loads = list(await db.scalars(select(FarmLoad).where(FarmLoad.load_date == day)))
    loaded_kg = q_kg(sum((l.loaded_weight_kg for l in loads), ZERO))

    bills = list(await db.scalars(select(DeliveryBill).where(DeliveryBill.bill_date == day)))
    delivered_kg = q_kg(sum((b.weight_kg for b in bills), ZERO))
    total_sales = q_money(sum((b.total_amount for b in bills), ZERO))
    total_collection = q_money(
        sum((b.cash_payment + b.upi_payment for b in bills), ZERO)
    )

    payments = list(
        await db.scalars(
            select(Payment).where(
                Payment.payment_date == day, Payment.type == PaymentType.RECEIVED
            )
        )
    )
    # Prefer payment rows (includes standalone collections) when present
    pay_total = q_money(sum((p.total_amount for p in payments), ZERO))
    if pay_total > total_collection:
        total_collection = pay_total

    outstanding = q_money(
        (
            await db.scalar(select(func.coalesce(func.sum(Retailer.credit_balance), 0)))
        )
        or ZERO
    )
    retailer_count = int(
        (await db.scalar(select(func.count()).select_from(Retailer).where(Retailer.is_active.is_(True))))
        or 0
    )

    stops = list(
        await db.scalars(
            select(DeliveryStop)
            .join(DeliveryRun, DeliveryStop.delivery_run_id == DeliveryRun.id)
            .where(DeliveryRun.run_date == day)
        )
    )
    completed = sum(1 for s in stops if s.status == DeliveryStopStatus.BILLED)
    skipped = sum(1 for s in stops if s.status == DeliveryStopStatus.SKIPPED)
    pending = sum(
        1
        for s in stops
        if s.status in {DeliveryStopStatus.PENDING, DeliveryStopStatus.WEIGHED}
    )

    loss_kg = q_kg(max(loaded_kg - delivered_kg, ZERO)) if loaded_kg > ZERO else ZERO
    loss_pct = (
        (loss_kg / loaded_kg * Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if loaded_kg > ZERO
        else ZERO
    )
    if loss_pct >= settings.weight_loss_alert_pct:
        loss_status = "ALERT"
    elif loss_pct >= settings.weight_loss_warn_pct:
        loss_status = "WARN"
    else:
        loss_status = "OK"

    return OpsDashboard(
        order_count=len(order_rows),
        ordered_kg=ordered_kg,
        loaded_kg=loaded_kg,
        delivered_kg=delivered_kg,
        pending_kg=q_kg(max(ordered_kg - delivered_kg, ZERO)),
        total_sales=total_sales,
        total_collection=total_collection,
        outstanding=outstanding,
        loss_kg=loss_kg,
        loss_pct=loss_pct,
        loss_status=loss_status,
        retailer_count=retailer_count,
        completed_deliveries=completed,
        pending_deliveries=pending,
        skipped_deliveries=skipped,
        weight_loss_warn_pct=settings.weight_loss_warn_pct,
        weight_loss_alert_pct=settings.weight_loss_alert_pct,
    )


async def mark_whatsapp_shared(db: AsyncSession, bill_id: UUID) -> DeliveryBillOut:
    bill = await db.scalar(select(DeliveryBill).where(DeliveryBill.id == bill_id))
    if bill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found")
    bill.whatsapp_shared_at = now_ist()
    await db.flush()
    return DeliveryBillOut.model_validate(bill, from_attributes=True)


# --- Payments / ledger ---


async def create_payment(
    db: AsyncSession, retailer_id: UUID, payload: PaymentCreate
) -> PaymentOut:
    retailer = await get_retailer(db, retailer_id)
    total = q_money(payload.cash_amount + payload.upi_amount)
    if total <= ZERO and payload.type == PaymentType.RECEIVED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment amount required")
    payment = Payment(
        retailer_id=retailer_id,
        payment_date=payload.payment_date or today_ist(),
        cash_amount=q_money(payload.cash_amount),
        upi_amount=q_money(payload.upi_amount),
        total_amount=total,
        type=payload.type,
        notes=payload.notes,
    )
    db.add(payment)
    if payload.type == PaymentType.RECEIVED:
        retailer.credit_balance = q_money(retailer.credit_balance - total)
    await db.flush()
    return PaymentOut.model_validate(payment, from_attributes=True)


async def get_ledger(db: AsyncSession, retailer_id: UUID) -> LedgerOut:
    retailer = await get_retailer(db, retailer_id)
    bills = list(
        await db.scalars(
            select(DeliveryBill)
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
    entries: list[LedgerEntry] = []
    for bill in bills:
        entries.append(
            LedgerEntry(
                entry_type="BILL",
                entry_date=bill.bill_date,
                reference=bill.bill_number,
                debit=bill.total_amount,
                credit=ZERO,
                notes=f"Wt {bill.weight_kg} kg @ {bill.rate_per_kg}",
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
                credit=payment.total_amount if payment.type == PaymentType.RECEIVED else ZERO,
                notes=payment.notes,
            )
        )
    entries.sort(key=lambda e: (e.entry_date, e.entry_type))
    running = q_money(retailer.opening_balance)
    for entry in entries:
        running = q_money(running + entry.debit - entry.credit)
        entry.balance_after = running

    return LedgerOut(
        retailer=RetailerOut.model_validate(retailer, from_attributes=True),
        opening_balance=retailer.opening_balance,
        credit_balance=retailer.credit_balance,
        entries=entries,
    )


# --- Weight loss / reports ---


async def compute_trip_weight_loss(db: AsyncSession, run_id: UUID) -> TripWeightLossOut:
    run = await db.scalar(select(DeliveryRun).where(DeliveryRun.id == run_id))
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery run not found")
    load = await db.scalar(select(FarmLoad).where(FarmLoad.id == run.farm_load_id))
    if load is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm load not found")

    delivered = await db.scalar(
        select(func.coalesce(func.sum(DeliveryStop.delivered_weight_kg), 0)).where(
            DeliveryStop.delivery_run_id == run_id,
            DeliveryStop.status.in_(
                [DeliveryStopStatus.WEIGHED, DeliveryStopStatus.BILLED]
            ),
        )
    )
    delivered_kg = q_kg(Decimal(str(delivered or 0)))
    loaded_kg = q_kg(load.loaded_weight_kg)
    loss_kg = q_kg(loaded_kg - delivered_kg)
    loss_pct = (
        q_money((loss_kg / loaded_kg) * Decimal("100")) if loaded_kg > 0 else Decimal("0.00")
    )

    existing = await db.scalar(
        select(TripWeightLoss).where(TripWeightLoss.delivery_run_id == run_id)
    )
    if existing:
        existing.loaded_kg = loaded_kg
        existing.delivered_kg = delivered_kg
        existing.loss_kg = loss_kg
        existing.loss_pct = loss_pct
        existing.computed_at = now_ist()
        row = existing
    else:
        row = TripWeightLoss(
            farm_load_id=load.id,
            delivery_run_id=run.id,
            loaded_kg=loaded_kg,
            delivered_kg=delivered_kg,
            loss_kg=loss_kg,
            loss_pct=loss_pct,
        )
        db.add(row)
    await db.flush()
    return TripWeightLossOut.model_validate(row, from_attributes=True)


async def complete_delivery_run(db: AsyncSession, run_id: UUID) -> DeliveryRunOut:
    run = await db.scalar(select(DeliveryRun).where(DeliveryRun.id == run_id))
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery run not found")
    run.status = DeliveryRunStatus.COMPLETED
    run.completed_at = now_ist()
    load = await db.scalar(select(FarmLoad).where(FarmLoad.id == run.farm_load_id))
    if load:
        load.status = FarmLoadStatus.CLOSED
    await compute_trip_weight_loss(db, run_id)
    await db.flush()
    return await get_delivery_run(db, run_id)


async def report_summary(db: AsyncSession, start: date, end: date) -> ReportSummary:
    ordered = await db.scalar(
        select(func.coalesce(func.sum(RetailerDailyOrder.requested_kg), 0)).where(
            RetailerDailyOrder.order_date >= start,
            RetailerDailyOrder.order_date <= end,
            RetailerDailyOrder.status != OrderStatus.CANCELLED,
        )
    )
    delivered = await db.scalar(
        select(func.coalesce(func.sum(DeliveryBill.weight_kg), 0)).where(
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
    loss_rows = list(await db.scalars(select(TripWeightLoss)))
    run_ids = {row.delivery_run_id for row in loss_rows}
    runs = {}
    if run_ids:
        for r in await db.scalars(select(DeliveryRun).where(DeliveryRun.id.in_(run_ids))):
            runs[r.id] = r
    total_loss = Decimal("0.000")
    for row in loss_rows:
        run = runs.get(row.delivery_run_id)
        if run and start <= run.run_date <= end:
            total_loss += row.loss_kg

    return ReportSummary(
        period_start=start,
        period_end=end,
        total_ordered_kg=q_kg(Decimal(str(ordered or 0))),
        total_delivered_kg=q_kg(Decimal(str(delivered or 0))),
        total_sales_amount=q_money(Decimal(str(sales or 0))),
        total_collections=q_money(Decimal(str(collections or 0))),
        total_loss_kg=q_kg(total_loss),
    )


def build_report_pdf(summary: ReportSummary) -> bytes:
    from io import BytesIO

    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

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

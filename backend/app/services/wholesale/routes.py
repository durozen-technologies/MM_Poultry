from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.timezone import today_ist
from app.models.domain import Retailer, RetailerDailyOrder, Route
from app.models.enums import OrderStatus
from app.schemas import (
    RetailerOut,
    RouteCreate,
    RouteDetailOut,
    RouteOut,
    RouteRetailerOut,
    RouteRetailersReplace,
    RouteUpdate,
)


def sync_retailer_route_fields(retailer: Retailer, route: Route | None) -> None:
    if route is not None:
        retailer.route_id = route.id
        retailer.route_name = route.name
    else:
        retailer.route_id = None
        retailer.route_name = None


async def _get_route_or_404(db: AsyncSession, route_id: UUID) -> Route:
    route = await db.scalar(select(Route).where(Route.id == route_id))
    if route is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route not found")
    return route


async def _route_name_exists(db: AsyncSession, name: str, *, exclude_id: UUID | None = None) -> bool:
    stmt = select(Route.id).where(func.lower(Route.name) == name.strip().lower())
    if exclude_id is not None:
        stmt = stmt.where(Route.id != exclude_id)
    return (await db.scalar(stmt)) is not None


async def _retailer_counts(db: AsyncSession) -> dict[UUID, int]:
    rows = await db.execute(
        select(Retailer.route_id, func.count())
        .where(Retailer.route_id.is_not(None))
        .group_by(Retailer.route_id)
    )
    return {route_id: count for route_id, count in rows.all()}


async def _today_order_counts(db: AsyncSession) -> dict[UUID, int]:
    day = today_ist()
    rows = await db.execute(
        select(Retailer.route_id, func.count(RetailerDailyOrder.id.distinct()))
        .join(RetailerDailyOrder, RetailerDailyOrder.retailer_id == Retailer.id)
        .where(
            Retailer.route_id.is_not(None),
            RetailerDailyOrder.order_date == day,
            RetailerDailyOrder.status != OrderStatus.CANCELLED,
        )
        .group_by(Retailer.route_id)
    )
    return {route_id: count for route_id, count in rows.all()}


def _route_out(
    route: Route,
    *,
    retailer_count: int = 0,
    today_order_count: int = 0,
) -> RouteOut:
    return RouteOut(
        id=route.id,
        name=route.name,
        area=route.area,
        description=route.description,
        sort_order=route.sort_order,
        is_active=route.is_active,
        retailer_count=retailer_count,
        today_order_count=today_order_count,
    )


async def list_routes(db: AsyncSession) -> list[RouteOut]:
    counts = await _retailer_counts(db)
    routes = list(
        await db.scalars(
            select(Route).order_by(Route.is_active.desc(), Route.sort_order.nulls_last(), Route.name)
        )
    )
    return [_route_out(r, retailer_count=counts.get(r.id, 0)) for r in routes]


async def get_route(db: AsyncSession, route_id: UUID) -> RouteDetailOut:
    route = await _get_route_or_404(db, route_id)
    retailers = list(
        await db.scalars(
            select(Retailer)
            .where(Retailer.route_id == route_id)
            .order_by(Retailer.shop_name.nulls_last(), Retailer.name)
        )
    )
    count = len(retailers)
    base = _route_out(route, retailer_count=count)
    return RouteDetailOut(
        **base.model_dump(),
        retailers=[RouteRetailerOut.model_validate(r, from_attributes=True) for r in retailers],
    )


async def create_route(db: AsyncSession, payload: RouteCreate) -> RouteOut:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Route name is required")
    if await _route_name_exists(db, name):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Route name already exists")
    route = Route(
        name=name,
        area=payload.area.strip() if payload.area else None,
        description=payload.description,
        sort_order=payload.sort_order,
    )
    db.add(route)
    await db.flush()
    return _route_out(route, retailer_count=0)


async def update_route(db: AsyncSession, route_id: UUID, payload: RouteUpdate) -> RouteOut:
    route = await _get_route_or_404(db, route_id)
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        name = data["name"].strip()
        if not name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Route name is required")
        if await _route_name_exists(db, name, exclude_id=route_id):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Route name already exists")
        route.name = name
        retailers = list(await db.scalars(select(Retailer).where(Retailer.route_id == route_id)))
        for retailer in retailers:
            sync_retailer_route_fields(retailer, route)
    if "area" in data:
        route.area = data["area"].strip() if data["area"] else None
    if "description" in data:
        route.description = data["description"]
    if "sort_order" in data:
        route.sort_order = data["sort_order"]
    if "is_active" in data and data["is_active"] is not None:
        route.is_active = data["is_active"]
    await db.flush()
    count = await db.scalar(
        select(func.count()).select_from(Retailer).where(Retailer.route_id == route_id)
    )
    return _route_out(route, retailer_count=int(count or 0))


async def deactivate_route(db: AsyncSession, route_id: UUID) -> None:
    route = await _get_route_or_404(db, route_id)
    route.is_active = False
    retailers = list(await db.scalars(select(Retailer).where(Retailer.route_id == route_id)))
    for retailer in retailers:
        sync_retailer_route_fields(retailer, None)
    await db.flush()


async def replace_route_retailers(
    db: AsyncSession, route_id: UUID, payload: RouteRetailersReplace
) -> RouteDetailOut:
    route = await _get_route_or_404(db, route_id)
    if not route.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot assign to inactive route")

    new_ids = list(dict.fromkeys(payload.retailer_ids))
    retailers_by_id: dict[UUID, Retailer] = {}
    if new_ids:
        retailers = list(await db.scalars(select(Retailer).where(Retailer.id.in_(new_ids))))
        retailers_by_id = {r.id: r for r in retailers}
        missing = set(new_ids) - retailers_by_id.keys()
        if missing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Retailer {next(iter(missing))} not found",
            )
        conflict_route_ids = {
            r.route_id for r in retailers if r.route_id is not None and r.route_id != route_id
        }
        if conflict_route_ids:
            other_routes = {
                r.id: r
                for r in await db.scalars(select(Route).where(Route.id.in_(conflict_route_ids)))
            }
            for retailer in retailers:
                if retailer.route_id is not None and retailer.route_id != route_id:
                    other = other_routes.get(retailer.route_id)
                    other_name = other.name if other else "another route"
                    label = retailer.shop_name or retailer.name
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Retailer {label} is already on route {other_name}",
                    )

    current = list(await db.scalars(select(Retailer).where(Retailer.route_id == route_id)))
    new_id_set = set(new_ids)

    for retailer in current:
        if retailer.id not in new_id_set:
            sync_retailer_route_fields(retailer, None)

    for rid in new_ids:
        sync_retailer_route_fields(retailers_by_id[rid], route)

    await db.flush()
    return await get_route(db, route_id)


async def count_unassigned_retailers(db: AsyncSession) -> int:
    count = await db.scalar(
        select(func.count())
        .select_from(Retailer)
        .where(Retailer.route_id.is_(None), Retailer.is_active.is_(True))
    )
    return int(count or 0)


async def list_unassigned_retailers(
    db: AsyncSession, *, cursor: str | None = None, limit: int = 50
) -> tuple[list[RetailerOut], bool, str | None, int]:
    stmt = (
        select(Retailer)
        .where(Retailer.route_id.is_(None), Retailer.is_active.is_(True))
        .order_by(Retailer.created_at.desc(), Retailer.id.desc())
        .limit(limit + 1)
    )
    if cursor:
        stmt = stmt.where(Retailer.id < UUID(cursor))
    rows = list(await db.scalars(stmt))
    has_more = len(rows) > limit
    rows = rows[:limit]
    next_cursor = str(rows[-1].id) if has_more and rows else None
    total = await count_unassigned_retailers(db) if cursor is None else 0
    return (
        await retailers_to_out(db, rows),
        has_more,
        next_cursor,
        total,
    )


async def retailers_to_out(db: AsyncSession, retailers: list[Retailer]) -> list[RetailerOut]:
    route_ids = {r.route_id for r in retailers if r.route_id is not None}
    routes_map: dict[UUID, Route] = {}
    if route_ids:
        routes_map = {
            route.id: route
            for route in await db.scalars(select(Route).where(Route.id.in_(route_ids)))
        }
    out_list: list[RetailerOut] = []
    for retailer in retailers:
        out = RetailerOut.model_validate(retailer, from_attributes=True)
        route = routes_map.get(retailer.route_id) if retailer.route_id else None
        out.route_area = route.area if route else None
        out_list.append(out)
    return out_list


async def retailer_to_out(db: AsyncSession, retailer: Retailer) -> RetailerOut:
    rows = await retailers_to_out(db, [retailer])
    return rows[0]


async def apply_retailer_route_id(
    db: AsyncSession, retailer: Retailer, route_id: UUID | None
) -> None:
    if route_id is None:
        sync_retailer_route_fields(retailer, None)
        return
    route = await _get_route_or_404(db, route_id)
    if not route.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot assign to inactive route")
    sync_retailer_route_fields(retailer, route)


async def list_delivery_routes(db: AsyncSession) -> list[RouteOut]:
    counts = await _retailer_counts(db)
    order_counts = await _today_order_counts(db)
    routes = list(
        await db.scalars(
            select(Route)
            .where(Route.is_active.is_(True))
            .order_by(Route.sort_order.nulls_last(), Route.name)
        )
    )
    return [
        _route_out(
            r,
            retailer_count=counts.get(r.id, 0),
            today_order_count=order_counts.get(r.id, 0),
        )
        for r in routes
    ]


async def list_orders_for_route(db: AsyncSession, route_id: UUID):
    await _get_route_or_404(db, route_id)
    from app.services.wholesale.orders import list_today_orders

    return await list_today_orders(db, route_id=route_id)

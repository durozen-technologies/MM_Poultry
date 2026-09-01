from __future__ import annotations

from fastapi import APIRouter

from app.routers.admin_dashboard import router as admin_dashboard_router
from app.routers.admin_expenses import router as admin_expenses_router
from app.routers.admin_farms import router as admin_farms_router
from app.routers.admin_inventory import router as admin_inventory_router
from app.routers.admin_items import router as admin_items_router
from app.routers.admin_orders import router as admin_orders_router
from app.routers.admin_reports import router as admin_reports_router
from app.routers.admin_retailers import router as admin_retailers_router
from app.routers.admin_settings import router as admin_settings_router
from app.routers.admin_users import router as admin_users_router
from app.routers.auth import router as auth_router
from app.routers.delivery import router as delivery_router
from app.routers.health import health_router
from app.routers.retailer import router as retailer_router
from app.routers.super_admin import router as super_admin_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(super_admin_router)
api_router.include_router(admin_users_router)
api_router.include_router(admin_items_router)
api_router.include_router(admin_retailers_router)
api_router.include_router(admin_orders_router)
api_router.include_router(admin_farms_router)
api_router.include_router(admin_inventory_router)
api_router.include_router(admin_dashboard_router)
api_router.include_router(admin_reports_router)
api_router.include_router(admin_expenses_router)
api_router.include_router(admin_settings_router)
api_router.include_router(delivery_router)
api_router.include_router(retailer_router)

__all__ = ["api_router", "health_router"]

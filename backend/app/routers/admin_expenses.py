from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.auth.dependencies import AuthContext, require_roles
from app.models.enums import UserRole
from app.schemas.expense import (
    ExpenseCategoryCreate,
    ExpenseCategoryOut,
    ExpenseCreate,
    ExpenseOut,
    ExpensePage,
)
from app.services.wholesale import expenses as svc

router = APIRouter(prefix="/admin", tags=["admin/expenses"])


@router.get("/expense-categories", response_model=list[ExpenseCategoryOut])
async def list_expense_categories(
    active_only: bool = True,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))] = None,
) -> list[ExpenseCategoryOut]:
    """List expense categories available for the tenant."""
    items = await svc.get_expense_categories(auth.db, active_only)
    return [ExpenseCategoryOut.model_validate(x) for x in items]


@router.post("/expense-categories", response_model=ExpenseCategoryOut, status_code=201)
async def create_expense_category(
    payload: ExpenseCategoryCreate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))] = None,
) -> ExpenseCategoryOut:
    """Create a new expense category."""
    cat = await svc.create_expense_category(auth.db, payload)
    await auth.db.commit()
    return ExpenseCategoryOut.model_validate(cat)


@router.get("/expenses", response_model=ExpensePage)
async def list_expenses(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    from_date: date | None = None,
    to_date: date | None = None,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))] = None,
) -> ExpensePage:
    """List expenses with pagination and optional date filters."""
    return await svc.list_expenses(auth.db, page, size, from_date, to_date)


@router.post("/expenses", response_model=ExpenseOut, status_code=201)
async def create_expense(
    payload: ExpenseCreate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))] = None,
) -> ExpenseOut:
    """Log a new expense."""
    exp = await svc.create_expense(auth.db, payload, auth.user.id)
    await auth.db.commit()
    # Need to reload it to get relationships for Output
    # But since it's a create, we can just return it and the client can refresh, or we can fetch it fully.
    # We will let the schema validation pass without joined tables (as created_by_user_name is None)
    return ExpenseOut.model_validate(exp)


@router.delete("/expenses/{expense_id}", status_code=204)
async def delete_expense(
    expense_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))] = None,
) -> None:
    """Delete an expense record."""
    await svc.delete_expense(auth.db, expense_id)
    await auth.db.commit()

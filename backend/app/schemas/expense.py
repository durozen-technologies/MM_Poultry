from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ExpenseCategoryCreate(BaseModel):
    name: str = Field(..., max_length=120)
    is_active: bool = True


class ExpenseCategoryOut(BaseModel):
    id: UUID
    name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExpenseCreate(BaseModel):
    category_id: UUID
    amount: Decimal = Field(..., gt=0, decimal_places=2)
    expense_date: date
    payment_method: str | None = Field(None, max_length=50)
    notes: str | None = Field(None, max_length=500)


class ExpenseOut(BaseModel):
    id: UUID
    category_id: UUID
    amount: Decimal
    expense_date: date
    payment_method: str | None
    notes: str | None
    created_by_user_id: UUID | None
    created_at: datetime
    updated_at: datetime
    
    # Optional nested info
    category_name: str | None = None
    created_by_user_name: str | None = None

    model_config = ConfigDict(from_attributes=True)


class ExpensePage(BaseModel):
    items: list[ExpenseOut]
    total: int
    page: int
    size: int
    pages: int

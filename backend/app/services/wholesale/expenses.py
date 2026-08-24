import math
from datetime import date
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import Expense, ExpenseCategory
from app.models.user import User
from app.schemas.expense import ExpenseCategoryCreate, ExpenseCreate, ExpenseOut
from app.schemas.common import Page


async def get_expense_categories(db: AsyncSession, active_only: bool = True) -> list[ExpenseCategory]:
    stmt = select(ExpenseCategory).order_by(ExpenseCategory.name)
    if active_only:
        stmt = stmt.where(ExpenseCategory.is_active.is_(True))
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def create_expense_category(
    db: AsyncSession, category_in: ExpenseCategoryCreate
) -> ExpenseCategory:
    res = await db.execute(
        select(ExpenseCategory).where(ExpenseCategory.name.ilike(category_in.name))
    )
    if res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Expense category with this name already exists."},
        )
    cat = ExpenseCategory(**category_in.model_dump())
    db.add(cat)
    await db.flush()
    return cat


async def create_expense(
    db: AsyncSession, expense_in: ExpenseCreate, user_id: UUID
) -> Expense:
    res = await db.execute(
        select(ExpenseCategory).where(ExpenseCategory.id == expense_in.category_id)
    )
    if not res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Invalid category ID"},
        )
    expense = Expense(
        **expense_in.model_dump(),
        created_by_user_id=user_id
    )
    db.add(expense)
    await db.flush()
    return expense


async def list_expenses(
    db: AsyncSession,
    page: int = 1,
    size: int = 50,
    from_date: date | None = None,
    to_date: date | None = None,
) -> Page[ExpenseOut]:
    stmt = select(Expense, ExpenseCategory, User).outerjoin(
        ExpenseCategory, Expense.category_id == ExpenseCategory.id
    ).outerjoin(
        User, Expense.created_by_user_id == User.id
    )
    
    if from_date:
        stmt = stmt.where(Expense.expense_date >= from_date)
    if to_date:
        stmt = stmt.where(Expense.expense_date <= to_date)
        
    count_stmt = select(Expense)
    if from_date:
        count_stmt = count_stmt.where(Expense.expense_date >= from_date)
    if to_date:
        count_stmt = count_stmt.where(Expense.expense_date <= to_date)
        
    from sqlalchemy import func
    total_res = await db.execute(select(func.count()).select_from(count_stmt.subquery()))
    total = total_res.scalar_one()
    
    stmt = stmt.order_by(desc(Expense.expense_date), desc(Expense.created_at))
    stmt = stmt.offset((page - 1) * size).limit(size)
    
    res = await db.execute(stmt)
    items = res.all()
    
    out_items = []
    for exp, cat, user in items:
        out = ExpenseOut.model_validate(exp)
        out.category_name = cat.name if cat else None
        out.created_by_user_name = user.full_name or user.username if user else None
        out_items.append(out)
        
    return Page[ExpenseOut](
        items=out_items,
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total > 0 else 0
    )


async def delete_expense(db: AsyncSession, expense_id: UUID) -> None:
    res = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = res.scalar_one_or_none()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Expense not found"}
        )
    await db.delete(expense)
    await db.flush()

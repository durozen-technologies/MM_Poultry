from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int
    pages: int


class CursorPage(BaseModel, Generic[T]):
    items: list[T]
    has_more: bool = False
    next_cursor: str | None = None
    total_count: int | None = None

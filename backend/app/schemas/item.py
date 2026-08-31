from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ItemBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)
    uom: str = Field(default="KG", max_length=20)
    is_active: bool = True
    default_price: float = Field(default=0.0, ge=0)


class ItemCreate(ItemBase):
    pass


class ItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    uom: Optional[str] = None
    is_active: Optional[bool] = None
    default_price: Optional[float] = None


class ItemResponse(ItemBase):
    id: UUID

    model_config = ConfigDict(from_attributes=True)

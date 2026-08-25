from uuid import UUID
from pydantic import BaseModel, ConfigDict
from typing import Optional

class ItemBase(BaseModel):
    name: str
    description: Optional[str] = None
    uom: str = "KG"
    is_active: bool = True
    default_price: float = 0.0

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
    organization_id: UUID

    model_config = ConfigDict(from_attributes=True)

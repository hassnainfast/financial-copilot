from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class InventoryItem(BaseModel):
    """Inventory item schema."""
    id: Optional[int] = None
    user_id: str
    item_name: str
    quantity: float
    unit: str
    price_per_unit: Optional[float] = None
    last_updated: Optional[datetime] = None

class InventoryUpdate(BaseModel):
    """Inventory update schema."""
    item_name: str
    action: str  # "created", "incremented", "decremented"
    old_qty: float
    new_qty: float
    existed: bool

class InventoryListResponse(BaseModel):
    """Inventory list response schema."""
    inventory: List[InventoryItem]
    total_items: int
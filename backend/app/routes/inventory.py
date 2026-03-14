from fastapi import APIRouter, HTTPException, Form
from typing import List, Optional, Dict, Any
from app.services.inventory_service import InventoryService
from app.database import supabase
import json

router = APIRouter(prefix="/inventory", tags=["inventory"])

inventory_service = InventoryService()

@router.get("/list")
async def list_inventory(user_id: str):
    """Get all inventory items for a user."""
    
    try:
        items = await inventory_service.get_inventory(user_id)
        return {
            "inventory": items,
            "total_items": len(items)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/item")
async def get_inventory_item(user_id: str, item_name: str):
    """Get specific inventory item by name."""
    
    try:
        item = await inventory_service.get_item(user_id, item_name)
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        
        return {"item": item}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/item/{item_id}")
async def update_inventory_item(
    item_id: int,
    user_id: str = Form(...),
    updates: str = Form(...)
):
    """Manually update inventory item."""
    
    try:
        updates_dict = json.loads(updates)
        item = await inventory_service.update_item(user_id, item_id, updates_dict)
        
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        
        return {"item": item, "message": "Inventory updated"}
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid updates JSON")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/item/{item_id}")
async def delete_inventory_item(item_id: int, user_id: str = Form(...)):
    """Delete inventory item."""
    
    try:
        success = await inventory_service.delete_item(user_id, item_id)
        if not success:
            raise HTTPException(status_code=404, detail="Item not found")
        
        return {"message": "Item deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
from typing import Dict, Any, List
from datetime import datetime
from app.database import supabase

class InventoryService:
    """Service for inventory management and auto-updates."""
    
    async def update_inventory_for_items(
        self,
        user_id: str,
        items: List[Dict[str, Any]],
        transaction_type: str
    ) -> List[Dict[str, Any]]:
        """
        Update inventory based on transaction items.
        
        Logic:
        - If item exists: increment (expense/purchase) or decrement (income/sale)
        - If item doesn't exist: auto-create with extracted values
        """
        
        inventory_updates = []
        
        for item in items:
            item_name = item.get("item_name", "Unknown Item")
            quantity = item.get("quantity", 1)
            amount = item.get("amount", 0)
            unit = item.get("unit", "piece")
            
            # Check if item exists in inventory
            existing = supabase.table("inventory")\
                .select("*")\
                .eq("user_id", user_id)\
                .eq("item_name", item_name)\
                .execute()
            
            if existing.data:
                # Item exists - update quantity
                current_qty = existing.data[0]["quantity"]
                
                if transaction_type == "expense":
                    # Purchasing stock - increment
                    new_qty = current_qty + quantity
                    action = "incremented"
                else:
                    # Selling stock - decrement
                    new_qty = current_qty - quantity
                    action = "decremented"
                
                # Update inventory
                supabase.table("inventory")\
                    .update({
                        "quantity": new_qty,
                        "price_per_unit": amount,  # Update latest price
                        "last_updated": datetime.utcnow().isoformat()
                    })\
                    .eq("id", existing.data[0]["id"])\
                    .execute()
                
                inventory_updates.append({
                    "item_name": item_name,
                    "action": action,
                    "old_qty": current_qty,
                    "new_qty": new_qty,
                    "existed": True
                })
            
            else:
                # Item doesn't exist - auto-create
                # For expense (purchase): add to inventory
                # For income (sale): create with 0 or negative (sold from stock)
                if transaction_type=="expense":
                    initial_qty=quantity
                else:
                    initial_qty=0
                
                supabase.table("inventory").insert({
                    "user_id": user_id,
                    "item_name": item_name,
                    "quantity": initial_qty,
                    "unit": unit,
                    "price_per_unit": amount,
                    "last_updated": datetime.utcnow().isoformat()
                }).execute()
                
                inventory_updates.append({
                    "item_name": item_name,
                    "action": "created",
                    "old_qty": 0,
                    "new_qty": initial_qty,
                    "existed": False
                })
        
        return inventory_updates
    
    async def get_inventory(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all inventory items for a user."""
        
        result = supabase.table("inventory")\
            .select("*")\
            .eq("user_id", user_id)\
            .order("item_name")\
            .execute()
        
        return result.data if result.data else []
    
    async def get_item(self, user_id: str, item_name: str) -> Dict[str, Any]:
        """Get specific inventory item."""
        
        result = supabase.table("inventory")\
            .select("*")\
            .eq("user_id", user_id)\
            .eq("item_name", item_name)\
            .execute()
        
        return result.data[0] if result.data else None
    
    async def update_item(
        self,
        user_id: str,
        item_id: int,
        updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Manually update inventory item."""
        
        updates["last_updated"] = datetime.utcnow().isoformat()
        
        result = supabase.table("inventory")\
            .update(updates)\
            .eq("id", item_id)\
            .eq("user_id", user_id)\
            .execute()
        
        return result.data[0] if result.data else None
    
    async def delete_item(self, user_id: str, item_id: int) -> bool:
        """Delete inventory item."""
        
        result = supabase.table("inventory")\
            .delete()\
            .eq("id", item_id)\
            .eq("user_id", user_id)\
            .execute()
        
        return True if result.data else False
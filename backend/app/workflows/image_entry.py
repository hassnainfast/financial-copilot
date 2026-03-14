from typing import Dict, Any, List, Optional
from app.workflows.base import BaseWorkflow, WorkflowState
from app.services.llm.orchestrator import LLMOrchestrator
from app.services.audio.tts_service import TTSService
from app.services.inventory_service import InventoryService
from app.database import supabase
from datetime import date
import json

class ImageEntryWorkflow(BaseWorkflow):
    """
    Workflow for image receipt scanning with item-by-item confirmation.
    
    Flow:
    1. scan_image → Extract items from receipt
    2. review_items → Show all items, ask for confirmation
    3. edit_item → User edits specific item
    4. confirm_all → Final confirmation before save
    5. update_inventory → Auto +/- stock
    6. complete → All saved to DB
    """
    
    def __init__(self, state: WorkflowState):
        super().__init__(state)
        self.llm = LLMOrchestrator()
        self.tts = TTSService()
        self.inventory = InventoryService()
    
    async def execute_step(self, step: str, user_input: Any) -> Dict[str, Any]:
        """Execute workflow step based on current state."""
        
        if step == "scan_image":
            return await self._scan_image_step(user_input)
        elif step == "review_items":
            return await self._review_items_step(user_input)
        elif step == "edit_item":
            return await self._edit_item_step(user_input)
        elif step == "confirm_all":
            return await self._confirm_all_step(user_input)
        elif step == "update_inventory":
            return await self._update_inventory_step(user_input)
        else:
            raise ValueError(f"Unknown step: {step}")
    
    async def _scan_image_step(self, user_input: Dict[str, Any]) -> Dict[str, Any]:
        """Step 1: Scan image and extract items using Gemini Vision."""
        
        # Get image bytes and transaction type from input
        image_bytes = user_input.get("image_bytes")
        tx_type = user_input.get("type", "expense")  # From frontend button
        user_id = user_input.get("user_id")
        
        if not image_bytes:
            return {
                "next_step": "error",
                "message": "No image provided",
                "audio_url": None,
                "data": {},
                "is_complete": False
            }
        
        # Store in state
        self.state.data["type"] = tx_type
        self.state.data["user_id"] = user_id
        
        # Use LLM to analyze image
        try:
            extracted_data = await self.llm.analyze_receipt(image_bytes)
            
            if not extracted_data or "items" not in extracted_data:
                return {
                    "next_step": "error",
                    "message": "No items found in image. Please try again.",
                    "audio_url": await self._generate_error_audio("no_items"),
                    "data": {},
                    "is_complete": False
                }
            
            items = extracted_data.get("items", [])
            total_amount = extracted_data.get("total_amount", 0)
            overall_confidence = extracted_data.get("overall_confidence", 0.9)
            
            # Check for low confidence
            if overall_confidence < 0.6:
                self.state.data["low_confidence"] = True
                message = f"تصویر واضح نہیں ہے۔ میں نے صرف {len(items)} آئٹمز پڑھے۔ کیا دوبارہ کوشش کروں؟"
                audio_msg = "Image not clear. Should I retry?"
            else:
                self.state.data["low_confidence"] = False
                message = f"میں نے {len(items)} آئٹمز پائے۔ کل {total_amount} روپے۔ کیا سب درست ہے؟"
                audio_msg = f"Found {len(items)} items. Total {total_amount} rupees."
            
            # Store items in state
            self.state.data["items"] = items
            self.state.data["total_amount"] = total_amount
            self.state.data["receipt_date"] = extracted_data.get("receipt_date", str(date.today()))
            self.state.data["shop_name"] = extracted_data.get("shop_name", "")
            self.state.data["confirmed_count"] = 0
            
            self.state.current_step = "review_items"
            
            # Generate Urdu audio
            urdu_message = await self.llm.generate_audio_script(message, audio_msg)
            audio_path = await self.tts.generate_audio(
                urdu_message,
                f"image_scan_{self.state.session_id}.mp3"
            )
            
            return {
                "next_step": "review_items",
                "message": message,
                "audio_url": f"/{audio_path}".replace("\\", "/") if audio_path else None,
                "data": {
                    "items": items,
                    "total_amount": total_amount,
                    "total_items": len(items),
                    "low_confidence": self.state.data["low_confidence"]
                },
                "is_complete": False
            }
        
        except Exception as e:
            return {
                "next_step": "error",
                "message": f"Image analysis failed: {str(e)}",
                "audio_url": await self._generate_error_audio("analysis_failed"),
                "data": {},
                "is_complete": False
            }
    
    async def _review_items_step(self, user_input: Dict[str, Any]) -> Dict[str, Any]:
        """Step 2: Show all items and ask for confirmation."""
        
        action = user_input.get("action", "confirm_all")
        
        if action == "confirm_all":
            # User confirmed all items
            self.state.current_step = "confirm_all"
            
            items = self.state.data.get("items", [])
            total = self.state.data.get("total_amount", 0)
            
            message = f"کل {len(items)} آئٹمز، {total} روپے۔ کیا محفوظ کروں؟"
            urdu_message = await self.llm.generate_audio_script(message, "confirm_all")
            audio_path = await self.tts.generate_audio(
                urdu_message,
                f"image_confirm_all_{self.state.session_id}.mp3"
            )
            
            return {
                "next_step": "confirm_all",
                "message": "Please confirm final save",
                "audio_url": f"/{audio_path}".replace("\\", "/") if audio_path else None,
                "data": self.state.data,
                "is_complete": False
            }
        
        elif action == "edit_item":
            # User wants to edit specific item
            item_index = user_input.get("item_index", 0)
            return {
                "next_step": "edit_item",
                "message": f"Edit item {item_index + 1}",
                "audio_url": None,
                "data": {
                    "item_to_edit": self.state.data["items"][item_index] if item_index < len(self.state.data["items"]) else None
                },
                "is_complete": False
            }
        
        elif action == "add_item":
            # User wants to add missing item
            return {
                "next_step": "edit_item",
                "message": "Add new item",
                "audio_url": None,
                "data": {"adding_new": True},
                "is_complete": False
            }
        
        elif action == "retry_scan":
            # Low confidence - user wants to rescan
            return {
                "next_step": "scan_image",
                "message": "Please upload image again",
                "audio_url": None,
                "data": {},
                "is_complete": False
            }
        
        else:
            raise ValueError(f"Unknown action: {action}")
    
    async def _edit_item_step(self, user_input: Dict[str, Any]) -> Dict[str, Any]:
        """Step 3: Edit specific item or add new item."""
        
        corrections = user_input.get("corrections", {})
        item_index = user_input.get("item_index")
        adding_new = user_input.get("adding_new", False)
        
        items = self.state.data.get("items", [])
        
        if adding_new:
            # Add new item to list
            new_item = {
                "item_index": len(items),
                "item_name": corrections.get("item_name", "Unknown Item"),
                "amount": corrections.get("amount", 0),
                "quantity": corrections.get("quantity", 1),
                "category": corrections.get("category", "General"),
                "unit": corrections.get("unit", "piece"),
                "confirmed": False,
                "edited": True
            }
            items.append(new_item)
            message = f"نیا آئٹم شامل ہو گیا: {new_item['item_name']}"
        else:
            # Update existing item
            if item_index is not None and item_index < len(items):
                original_item = items[item_index].copy()
                
                # Use LLM to apply corrections
                updated_item = await self.llm.correct_transaction(original_item, json.dumps(corrections))
                updated_item["edited"] = True
                updated_item["item_index"] = item_index
                
                items[item_index] = updated_item
                message = f"آئٹم {item_index + 1} اپڈیٹ ہو گیا"
            else:
                message = "Item not found"
        
        # Update state
        self.state.data["items"] = items
        
        # Recalculate total
        self.state.data["total_amount"] = sum(item.get("amount", 0) for item in items)
        
        # Generate audio
        urdu_message = await self.llm.generate_audio_script(message, "item_updated")
        audio_path = await self.tts.generate_audio(
            urdu_message,
            f"image_edit_{self.state.session_id}.mp3"
        )
        
        self.state.current_step = "review_items"
        
        return {
            "next_step": "review_items",
            "message": message,
            "audio_url": f"/{audio_path}".replace("\\", "/") if audio_path else None,
            "data": {
                "items": items,
                "total_amount": self.state.data["total_amount"]
            },
            "is_complete": False
        }
    
    async def _confirm_all_step(self, user_input: Dict[str, Any]) -> Dict[str, Any]:
        """Step 4: Final confirmation before saving."""
        
        confirm = user_input.get("confirm", False) or user_input.get("action") == "confirm"
        
        if confirm:
            self.state.current_step = "update_inventory"
            
            message = "محفوظ کر رہا ہوں..."
            urdu_message = await self.llm.generate_audio_script(message, "saving")
            audio_path = await self.tts.generate_audio(
                urdu_message,
                f"image_saving_{self.state.session_id}.mp3"
            )
            
            return {
                "next_step": "update_inventory",
                "message": "Saving to database...",
                "audio_url": f"/{audio_path}".replace("\\", "/") if audio_path else None,
                "data": self.state.data,
                "is_complete": False
            }
        else:
            # User cancelled
            message = "منسوخ ہو گیا"
            urdu_message = await self.llm.generate_audio_script(message, "cancelled")
            audio_path = await self.tts.generate_audio(
                urdu_message,
                f"image_cancelled_{self.state.session_id}.mp3"
            )
            
            return {
                "next_step": "cancelled",
                "message": "Workflow cancelled",
                "audio_url": f"/{audio_path}".replace("\\", "/") if audio_path else None,
                "data": {},
                "is_complete": True
            }
    
    async def _update_inventory_step(self, user_input: Dict[str, Any]) -> Dict[str, Any]:
        """Step 5: Update inventory and save transactions."""
        
        user_id = self.state.data.get("user_id")
        items = self.state.data.get("items", [])
        tx_type = self.state.data.get("type", "expense")
        receipt_date = self.state.data.get("receipt_date", str(date.today()))
        
        try:
            # Save transactions
            transaction_ids = []
            for item in items:
                result = supabase.table("transactions").insert({
                    "user_id": user_id,
                    "amount": item.get("amount", 0),
                    "type": tx_type,
                    "category": item.get("category", "General"),
                    "customer_name": self.state.data.get("shop_name", "Cash Customer"),
                    "description": item.get("item_name", ""),
                    "transaction_date": receipt_date,
                    "source": "image"
                }).execute()
                
                if result.data:
                    transaction_ids.append(result.data[0]["id"])
            
            # Update inventory
            inventory_updates = await self.inventory.update_inventory_for_items(
                user_id=user_id,
                items=items,
                transaction_type=tx_type
            )
            
            # Generate success audio with inventory summary
            message = f"کامیابی! {len(items)} آئٹمز محفوظ ہو گئے۔ کل {self.state.data['total_amount']} روپے۔"
            if inventory_updates:
                message += f" انوینٹری اپڈیٹ ہو گیا۔"
            
            urdu_message = await self.llm.generate_audio_script(message, "success")
            audio_path = await self.tts.generate_audio(
                urdu_message,
                f"image_success_{self.state.session_id}.mp3"
            )
            
            self.state.current_step = "complete"
            
            return {
                "next_step": "complete",
                "message": f"Success! {len(items)} items saved.",
                "audio_url": f"/{audio_path}".replace("\\", "/") if audio_path else None,
                "data": {
                    "transaction_ids": transaction_ids,
                    "inventory_updates": inventory_updates
                },
                "is_complete": True
            }
        
        except Exception as e:
            message = f"Error saving: {str(e)}"
            return {
                "next_step": "error",
                "message": message,
                "audio_url": None,
                "data": {},
                "is_complete": False
            }
    
    async def _generate_error_audio(self, error_type: str) -> Optional[str]:
        """Generate error audio message."""
        messages = {
            "no_items": "کوئی آئٹم نہیں ملا۔ کیا دستی داخل کریں گے؟",
            "analysis_failed": "تصویر تجزیہ ناکام۔ دوبارہ کوشش کریں۔",
            "save_failed": "محفوظ ناکام۔ دوبارہ کوشش کریں۔"
        }
        
        urdu_message = await self.llm.generate_audio_script(
            messages.get(error_type, "کوئی خرابی ہوئی"),
            error_type
        )
        
        audio_path = await self.tts.generate_audio(
            urdu_message,
            f"image_error_{error_type}_{self.state.session_id}.mp3"
        )
        
        return f"/{audio_path}".replace("\\", "/") if audio_path else None
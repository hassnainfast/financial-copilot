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
    4. remove_item → User removes specific item
    5. confirm_all → Final confirmation before save
    6. update_inventory → Auto +/- stock
    7. complete → All saved to DB
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
        elif step == "remove_item":
            return await self._remove_item_step(user_input)
        elif step == "confirm_all":
            return await self._confirm_all_step(user_input)
        elif step == "update_inventory":
            return await self._update_inventory_step(user_input)
        elif step == "error":
            # Gracefully handle error state — allow restarting
            return {
                "next_step": "error",
                "message": "Workflow encountered an error. Please start over.",
                "audio_url": None,
                "data": {},
                "is_complete": True
            }
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
            corrections = user_input.get("corrections")
            
            if corrections:
                # Corrections provided → apply them directly (single-step edit)
                self.state.current_step = "edit_item"
                return await self._edit_item_step(user_input)
            else:
                # No corrections → just show the item for editing
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
            corrections = user_input.get("corrections")
            
            if corrections:
                # Corrections provided → add item directly (single-step add)
                user_input["adding_new"] = True
                self.state.current_step = "edit_item"
                return await self._edit_item_step(user_input)
            else:
                # No corrections → just show the add form
                return {
                    "next_step": "edit_item",
                    "message": "Add new item",
                    "audio_url": None,
                    "data": {"adding_new": True},
                    "is_complete": False
                }
        
        elif action == "remove_item":
            # User wants to remove specific item
            item_index = user_input.get("item_index")
            if item_index is None:
                return {
                    "next_step": "review_items",
                    "message": "Please specify which item to remove",
                    "audio_url": None,
                    "data": {"items": self.state.data.get("items", [])},
                    "is_complete": False
                }
            # Forward directly to remove step (single-step remove)
            self.state.current_step = "remove_item"
            return await self._remove_item_step(user_input)
        
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
        
        corrections = user_input.get("corrections")  # Can be None, string, or dict
        item_index = user_input.get("item_index")
        adding_new = user_input.get("adding_new", False)
        
        items = self.state.data.get("items", [])
        
        # Check if user is SUBMITTING corrections
        if corrections and adding_new:
            # Adding a NEW item with corrections
            if isinstance(corrections, str):
                try:
                    corrections = json.loads(corrections)
                except json.JSONDecodeError:
                    return {
                        "next_step": "error",
                        "message": "Invalid corrections JSON",
                        "audio_url": None,
                        "data": {},
                        "is_complete": False
                    }
            
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
            
            # Update state
            self.state.data["items"] = items
            self.state.data["total_amount"] = sum(item.get("amount", 0) for item in items)
            
            message = f"نیا آئٹم شامل ہو گیا: {new_item['item_name']}"
            urdu_message = await self.llm.generate_audio_script(message, "item_added")
            audio_path = await self.tts.generate_audio(
                urdu_message,
                f"image_add_{self.state.session_id}.mp3"
            )
            
            self.state.current_step = "review_items"
            
            return {
                "next_step": "review_items",
                "message": f"Added: {new_item['item_name']}",
                "audio_url": f"/{audio_path}".replace("\\", "/") if audio_path else None,
                "data": {
                    "items": items,
                    "total_amount": self.state.data["total_amount"],
                    "total_items": len(items),
                    "new_item": new_item
                },
                "is_complete": False
            }
        
        elif corrections and item_index is not None and not adding_new:
            # Parse corrections if they're a JSON string
            if isinstance(corrections, str):
                try:
                    corrections = json.loads(corrections)
                except json.JSONDecodeError:
                    return {
                        "next_step": "error",
                        "message": "Invalid corrections JSON",
                        "audio_url": None,
                        "data": {},
                        "is_complete": False
                    }
            
            # Apply corrections to the item
            if 0 <= item_index < len(items):
                original_item = items[item_index].copy()
                
                # Update item with corrections
                updated_item = original_item.copy()
                updated_item.update(corrections)
                updated_item["edited"] = True
                updated_item["item_index"] = item_index
                
                items[item_index] = updated_item
                
                # Generate user-friendly message
                changes = []
                if "amount" in corrections:
                    changes.append(f"قیمت {original_item.get('amount')} سے {corrections['amount']}")
                if "quantity" in corrections:
                    changes.append(f"تعداد {original_item.get('quantity')} سے {corrections['quantity']}")
                if "item_name" in corrections:
                    changes.append(f"نام {corrections['item_name']}")
                if "category" in corrections:
                    changes.append(f"کیٹیگری {corrections['category']}")
                
                change_text = "، ".join(changes) if changes else "اپڈیٹ ہو گیا"
                message = f"آئٹم {item_index + 1} اپڈیٹ: {change_text}"
                
                # Update state
                self.state.data["items"] = items
                
                # Recalculate total
                self.state.data["total_amount"] = sum(item.get("amount", 0) for item in items)
                
                # Generate Urdu audio
                urdu_message = await self.llm.generate_audio_script(message, "item_updated")
                audio_path = await self.tts.generate_audio(
                    urdu_message,
                    f"image_edit_{self.state.session_id}.mp3"
                )
                
                # ✅ CRITICAL: Return to review_items after applying corrections
                self.state.current_step = "review_items"
                
                return {
                    "next_step": "review_items",  # ← Was incorrectly "edit_item"
                    "message": message,
                    "audio_url": f"/{audio_path}".replace("\\", "/") if audio_path else None,
                    "data": {
                        "items": items,
                        "total_amount": self.state.data["total_amount"],
                        "total_items": len(items),
                        "updated_item": updated_item
                    },
                    "is_complete": False
                }
            else:
                return {
                    "next_step": "error",
                    "message": f"Item index {item_index} not found",
                    "audio_url": None,
                    "data": {},
                    "is_complete": False
                }
        
        else:
            # User just wants to SEE the item to edit (no corrections submitted yet)
            if item_index is not None and 0 <= item_index < len(items):
                return {
                    "next_step": "edit_item",
                    "message": f"Edit item {item_index + 1}",
                    "audio_url": None,
                    "data": {
                        "item_to_edit": items[item_index]
                    },
                    "is_complete": False
                }
            elif adding_new:
                return {
                    "next_step": "edit_item",
                    "message": "Add new item",
                    "audio_url": None,
                    "data": {"adding_new": True},
                    "is_complete": False
                }
            else:
                return {
                    "next_step": "error",
                    "message": "Item index required for editing",
                    "audio_url": None,
                    "data": {},
                    "is_complete": False
                }
    
    async def _remove_item_step(self, user_input: Dict[str, Any]) -> Dict[str, Any]:
        """Remove a specific item from the scanned items list."""
        
        item_index = user_input.get("item_index")
        items = self.state.data.get("items", [])
        
        # Validate index
        if item_index is None or item_index < 0 or item_index >= len(items):
            message = "آئٹم نہیں ملا"
            urdu_message = await self.llm.generate_audio_script(message, "item_not_found")
            audio_path = await self.tts.generate_audio(
                urdu_message,
                f"image_remove_error_{self.state.session_id}.mp3"
            )
            
            self.state.current_step = "review_items"
            
            return {
                "next_step": "review_items",
                "message": "Item not found",
                "audio_url": f"/{audio_path}".replace("\\", "/") if audio_path else None,
                "data": {
                    "items": items,
                    "total_amount": self.state.data.get("total_amount", 0)
                },
                "is_complete": False
            }
        
        # Prevent removing the last item
        if len(items) <= 1:
            message = "آخری آئٹم نہیں ہٹا سکتے۔ منسوخ کرنے کے لیے کنفرم پر جائیں۔"
            urdu_message = await self.llm.generate_audio_script(message, "cannot_remove_last")
            audio_path = await self.tts.generate_audio(
                urdu_message,
                f"image_remove_last_{self.state.session_id}.mp3"
            )
            
            self.state.current_step = "review_items"
            
            return {
                "next_step": "review_items",
                "message": "Cannot remove the last item. Use cancel instead.",
                "audio_url": f"/{audio_path}".replace("\\", "/") if audio_path else None,
                "data": {
                    "items": items,
                    "total_amount": self.state.data.get("total_amount", 0)
                },
                "is_complete": False
            }
        
        # Remove the item
        removed_item = items.pop(item_index)
        removed_name = removed_item.get("item_name", "Unknown")
        
        # Re-index remaining items
        for i, item in enumerate(items):
            item["item_index"] = i
        
        # Update state
        self.state.data["items"] = items
        
        # Recalculate total
        self.state.data["total_amount"] = sum(item.get("amount", 0) for item in items)
        
        # Generate audio
        message = f"{removed_name} ہٹا دیا گیا۔ اب {len(items)} آئٹمز ہیں۔ کل {self.state.data['total_amount']} روپے۔"
        urdu_message = await self.llm.generate_audio_script(message, "item_removed")
        audio_path = await self.tts.generate_audio(
            urdu_message,
            f"image_remove_{self.state.session_id}.mp3"
        )
        
        self.state.current_step = "review_items"
        
        return {
            "next_step": "review_items",
            "message": f"Removed: {removed_name}. {len(items)} items remaining.",
            "audio_url": f"/{audio_path}".replace("\\", "/") if audio_path else None,
            "data": {
                "items": items,
                "total_amount": self.state.data["total_amount"],
                "removed_item": removed_item
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
from typing import Dict, Any
from app.workflows.base import BaseWorkflow, WorkflowState
from app.services.llm.orchestrator import LLMOrchestrator
from app.services.audio.tts_service import TTSService
from app.database import supabase
from datetime import date
import json

class ManualEntryWorkflow(BaseWorkflow):
    """
    Workflow for manual transaction entry with dynamic confirmation.
    
    Flow:
    1. preview → Show extracted data, ask for confirmation
    2. edit → User provides corrections
    3. confirm_final → Final confirmation before save
    4. complete → Transaction saved
    """
    
    def __init__(self, state: WorkflowState):
        super().__init__(state)
        self.llm = LLMOrchestrator()
        self.tts = TTSService()
    
    async def execute_step(self, step: str, user_input: Any) -> Dict[str, Any]:
        """Execute workflow step based on current state."""
        
        if step == "preview":
            return await self._preview_step(user_input)
        elif step == "edit":
            return await self._edit_step(user_input)
        elif step == "confirm_final":
            return await self._confirm_final_step(user_input)
        else:
            raise ValueError(f"Unknown step: {step}")
    
    async def _preview_step(self, user_input: Dict[str, Any]) -> Dict[str, Any]:
        """Step 1: Preview transaction data and ask for confirmation."""
        
        # ⚠️ FIX: Only store transaction if it's new data (not an action)
        if "action" not in user_input and "transaction" not in self.state.data:
            self.state.data["transaction"] = user_input
        
        # Get transaction from state (don't overwrite)
        tx = self.state.data.get("transaction", {})
        
        # Handle swapped type/category gracefully
        tx_type = tx.get("type", "expense")
        tx_category = tx.get("category", "General")
        
        # Ensure type is valid
        if tx_type not in ["income", "expense"]:
            # If user put category in type field, swap them
            if tx_category in ["income", "expense"]:
                tx_type, tx_category = tx_category, tx_type
                # Update in state
                self.state.data["transaction"]["type"] = tx_type
                self.state.data["transaction"]["category"] = tx_category
        
        self.state.current_step = "preview"
        
        # Generate confirmation message
        message = f"Confirm entry: {tx_type} of {tx.get('amount', 0)} rupees"
        if tx.get('customer_name') and tx.get('customer_name') != 'Cash Customer':
            message += f" from {tx['customer_name']}"
        if tx.get('category') and tx.get('category') != 'General':
            message += f" ({tx['category']})"
        message += ". Is this correct?"
        
        # Generate Urdu audio
        urdu_message = await self.llm.generate_audio_script(message, "confirmation")
        audio_path = await self.tts.generate_audio(
            urdu_message, 
            f"manual_preview_{self.state.session_id}.mp3"
        )
        
        return {
            "next_step": "edit",
            "message": message,
            "audio_url": f"/{audio_path}".replace("\\", "/") if audio_path else None,
            "data": self.state.data,
            "is_complete": False
        }
    
    async def _edit_step(self, user_input: Dict[str, Any]) -> Dict[str, Any]:
        """Step 2: Apply user's corrections."""
        
        action = user_input.get("action", "confirm")
        
        if action == "confirm":
            # User confirmed, move to final confirmation
            self.state.current_step = "confirm_final"
            
            message = "Please confirm final save"
            urdu_message = await self.llm.generate_audio_script(message, "saving")
            audio_path = await self.tts.generate_audio(
                urdu_message,
                f"manual_saving_{self.state.session_id}.mp3"
            )
            
            return {
                "next_step": "confirm_final",
                "message": "Please confirm final save",
                "audio_url": f"/{audio_path}".replace("\\", "/") if audio_path else None,
                "data": self.state.data,
                "is_complete": False
            }
        
        elif action == "edit":
            # User wants to edit - apply corrections
            corrections = user_input.get("corrections", {})
            original_tx = self.state.data.get("transaction", {})
            
            if not corrections:
                # No corrections provided, just re-confirm
                return await self._preview_step(original_tx)
            
            # Use LLM to apply corrections
            updated_tx = await self.llm.correct_transaction(original_tx, json.dumps(corrections))
            
            self.state.data["transaction"] = updated_tx
            
            # Generate message showing what changed
            message = f"Updated: Amount is now {updated_tx.get('amount')}"
            if updated_tx.get('customer_name') != original_tx.get('customer_name'):
                message += f", Customer: {updated_tx.get('customer_name')}"
            
            urdu_message = await self.llm.generate_audio_script(message, "updated")
            audio_path = await self.tts.generate_audio(
                urdu_message,
                f"manual_updated_{self.state.session_id}.mp3"
            )
            
            return {
                "next_step": "preview",
                "message": "Transaction updated. Please review again.",
                "audio_url": f"/{audio_path}".replace("\\", "/") if audio_path else None,
                "data": self.state.data,
                "is_complete": False
            }
        
        else:
            raise ValueError(f"Unknown action: {action}")
    
    async def _confirm_final_step(self, user_input: Dict[str, Any]) -> Dict[str, Any]:
        """Step 3: Final confirmation and save to database."""
        
        confirm = user_input.get("confirm", False) or user_input.get("action") == "confirm"
        
        if confirm:
            # Save to database
            tx = self.state.data.get("transaction", {})
            
            # Validate required fields
            required = ["user_id", "amount", "type"]
            missing = [f for f in required if not tx.get(f)]
            if missing:
                return {
                    "next_step": "error",
                    "message": f"Missing fields: {missing}",
                    "audio_url": None,
                    "data": {},
                    "is_complete": False
                }
            
            # Ensure type is valid
            tx_type = tx["type"]
            if tx_type not in ["income", "expense"]:
                tx_type = "expense"  # Default fallback
            
            try:
                result = supabase.table("transactions").insert({
                    "user_id": tx["user_id"],
                    "amount": tx["amount"],
                    "type": tx_type,
                    "category": tx.get("category", "General"),
                    "customer_name": tx.get("customer_name", "Cash Customer"),
                    "description": tx.get("description", ""),
                    "transaction_date": tx.get("transaction_date", str(date.today())),
                    "source": "manual"
                }).execute()
                
                message = f"Success! {tx['amount']} rupees saved."
                urdu_message = await self.llm.generate_audio_script(message, "success")
                audio_path = await self.tts.generate_audio(
                    urdu_message,
                    f"manual_success_{self.state.session_id}.mp3"
                )
                
                self.state.current_step = "complete"
                
                return {
                    "next_step": "complete",
                    "message": message,
                    "audio_url": f"/{audio_path}".replace("\\", "/") if audio_path else None,
                    "data": {"transaction_id": result.data[0]["id"] if result.data else None},
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
        
        else:
            # User cancelled
            message = "Transaction cancelled."
            urdu_message = await self.llm.generate_audio_script(message, "cancelled")
            audio_path = await self.tts.generate_audio(
                urdu_message,
                f"manual_cancelled_{self.state.session_id}.mp3"
            )
            
            return {
                "next_step": "cancelled",
                "message": message,
                "audio_url": f"/{audio_path}".replace("\\", "/") if audio_path else None,
                "data": {},
                "is_complete": True
            }
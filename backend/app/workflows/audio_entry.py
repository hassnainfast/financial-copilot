from typing import Dict, Any, List, Optional
from app.workflows.base import BaseWorkflow, WorkflowState
from app.services.llm.orchestrator import LLMOrchestrator
from app.services.audio.tts_service import TTSService
from app.services.audio.stt_service import STTService
from app.services.inventory_service import InventoryService
from app.database import supabase
from app.prompts.audio_prompts import (
    AUDIO_EXTRACTION_SYSTEM_PROMPT,
    AUDIO_WELCOME_MESSAGES,
    AUDIO_CONFIRMATION_PROMPT,
    AUDIO_SUCCESS_MESSAGE,
    AUDIO_ERROR_MESSAGES,
)
from datetime import date
import json
import os


class AudioEntryWorkflow(BaseWorkflow):
    """
    Workflow for voice-based transaction data entry.
    
    Flow:
    1. start       → Initialize session, generate welcome audio
    2. listening   → Wait for audio/text input
    3. processing  → STT + LLM extraction + apply changes
    4. summarizing → Generate Urdu summary, ask confirmation
    5. saving      → DB insert + inventory update
    6. complete    → Success audio
    
    The workflow loops between listening → processing → summarizing
    until the user confirms (completion_detected=true).
    """
    
    MAX_CHAT_HISTORY = 10  # Keep last N messages for context
    
    def __init__(self, state: WorkflowState):
        super().__init__(state)
        self.llm = LLMOrchestrator()
        self.tts = TTSService()
        self.stt = STTService()
        self.inventory = InventoryService()
    
    async def execute_step(self, step: str, user_input: Any) -> Dict[str, Any]:
        """Execute workflow step based on current state."""
        
        if step == "start":
            return await self._start_step(user_input)
        elif step == "listening":
            return await self._listening_step(user_input)
        elif step == "processing":
            return await self._processing_step(user_input)
        elif step == "saving":
            return await self._saving_step(user_input)
        elif step == "error":
            return {
                "next_step": "error",
                "message": "Workflow encountered an error. Please start over.",
                "audio_url": None,
                "data": {},
                "is_complete": True
            }
        else:
            raise ValueError(f"Unknown step: {step}")
    
    # ─────────────────────────────────────────────
    # Step 1: START — Initialize session
    # ─────────────────────────────────────────────
    
    async def _start_step(self, user_input: Dict[str, Any]) -> Dict[str, Any]:
        """Initialize audio session and generate welcome audio."""
        
        user_id = user_input.get("user_id")
        transaction_type = user_input.get("type", "expense")
        
        # Validate transaction type
        if transaction_type not in ["income", "expense"]:
            transaction_type = "expense"
        
        # Initialize state
        self.state.data["user_id"] = user_id
        self.state.data["transaction_type"] = transaction_type
        self.state.data["extracted_items"] = []
        self.state.data["chat_history"] = []
        
        # Generate welcome audio in Urdu
        welcome_text = AUDIO_WELCOME_MESSAGES.get(transaction_type, AUDIO_WELCOME_MESSAGES["expense"])
        audio_path = await self.tts.generate_audio(
            welcome_text,
            f"audio_welcome_{self.state.session_id}.mp3"
        )
        
        self.state.current_step = "listening"
        
        return {
            "next_step": "listening",
            "message": welcome_text,
            "audio_url": f"/{audio_path}".replace("\\", "/") if audio_path else None,
            "data": {
                "extracted_items": [],
                "chat_history": [],
                "transaction_type": transaction_type
            },
            "is_complete": False
        }
    
    # ─────────────────────────────────────────────
    # Step 2: LISTENING — Receive audio/text input
    # ─────────────────────────────────────────────
    
    async def _listening_step(self, user_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        Receive user input (audio file or text) and forward to processing.
        
        Accepts:
        - audio_file_path: path to uploaded audio file → runs STT
        - user_text: pre-transcribed text from frontend → skips STT
        """
        
        audio_file_path = user_input.get("audio_file_path")
        user_text = user_input.get("user_text")
        
        # If audio file provided, transcribe it
        if audio_file_path and not user_text:
            user_text = await self.stt.transcribe_audio(audio_file_path)
            
            if not user_text:
                # STT failed - ask user to repeat
                error_text = AUDIO_ERROR_MESSAGES["no_speech"]
                audio_path = await self.tts.generate_audio(
                    error_text,
                    f"audio_no_speech_{self.state.session_id}.mp3"
                )
                
                return {
                    "next_step": "listening",
                    "message": error_text,
                    "audio_url": f"/{audio_path}".replace("\\", "/") if audio_path else None,
                    "data": {
                        "extracted_items": self.state.data.get("extracted_items", []),
                        "chat_history": self.state.data.get("chat_history", [])
                    },
                    "is_complete": False
                }
        
        if not user_text:
            return {
                "next_step": "listening",
                "message": "No input received. Please speak or send text.",
                "audio_url": None,
                "data": {
                    "extracted_items": self.state.data.get("extracted_items", []),
                    "chat_history": self.state.data.get("chat_history", [])
                },
                "is_complete": False
            }
        
        # Forward to processing with the transcribed/provided text
        self.state.current_step = "processing"
        return await self._processing_step({"user_text": user_text})
    
    # ─────────────────────────────────────────────
    # Step 3: PROCESSING — LLM extraction + apply
    # ─────────────────────────────────────────────
    
    async def _processing_step(self, user_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        Core logic: Send user text + chat history to LLM, parse response,
        apply new items/edits/removals, and generate summary audio.
        """
        
        user_text = user_input.get("user_text", "")
        
        transaction_type = self.state.data.get("transaction_type", "expense")
        user_id = self.state.data.get("user_id", "user_01")
        extracted_items = self.state.data.get("extracted_items", [])
        chat_history = self.state.data.get("chat_history", [])
        
        # ── Build system prompt with context ──
        system_prompt = AUDIO_EXTRACTION_SYSTEM_PROMPT.format(
            transaction_type=transaction_type,
            user_id=user_id,
            extracted_items=json.dumps(extracted_items, ensure_ascii=False) if extracted_items else "[]",
            today_date=str(date.today())
        )
        
        # ── Build messages array for multi-turn ──
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add recent chat history (last N messages)
        recent_history = chat_history[-(self.MAX_CHAT_HISTORY):]
        messages.extend(recent_history)
        
        # Add current user message
        messages.append({"role": "user", "content": user_text})
        
        # ── Call LLM ──
        try:
            llm_response = await self.llm.extract_audio_transaction(messages)
        except Exception as e:
            print(f"❌ LLM extraction error: {e}")
            error_text = AUDIO_ERROR_MESSAGES["extraction_failed"]
            audio_path = await self.tts.generate_audio(
                error_text,
                f"audio_extraction_error_{self.state.session_id}.mp3"
            )
            
            self.state.current_step = "listening"
            
            return {
                "next_step": "listening",
                "message": error_text,
                "audio_url": f"/{audio_path}".replace("\\", "/") if audio_path else None,
                "data": {
                    "extracted_items": extracted_items,
                    "chat_history": chat_history
                },
                "is_complete": False
            }
        
        # ── Apply changes from LLM response ──
        
        # 1. Apply new items
        new_items = llm_response.get("new_items", [])
        for item in new_items:
            item["item_index"] = len(extracted_items)
            item.setdefault("quantity", 1)
            item.setdefault("category", "General")
            item.setdefault("unit", "piece")
            item.setdefault("customer_name", "Cash Customer")
            item.setdefault("description", item.get("item_name", ""))
            extracted_items.append(item)
        
        # 2. Apply edits
        edits = llm_response.get("edits", [])
        for edit in edits:
            idx = edit.get("item_index")
            updates = edit.get("updates", {})
            if idx is not None and 0 <= idx < len(extracted_items):
                extracted_items[idx].update(updates)
                extracted_items[idx]["edited"] = True
        
        # 3. Apply removals (sort descending to avoid index shift)
        removals = llm_response.get("removals", [])
        for idx in sorted(removals, reverse=True):
            if 0 <= idx < len(extracted_items):
                extracted_items.pop(idx)
        
        # Re-index all items after removals
        for i, item in enumerate(extracted_items):
            item["item_index"] = i
        
        # 4. Check for completion
        completion_detected = llm_response.get("completion_detected", False)
        
        # 5. Get summary text
        summary_urdu = llm_response.get("summary_urdu", "")
        clarification = llm_response.get("clarification_needed")
        
        # ── Update chat history ──
        chat_history.append({"role": "user", "content": user_text})
        chat_history.append({"role": "assistant", "content": json.dumps(llm_response, ensure_ascii=False)})
        
        # ── Update state ──
        self.state.data["extracted_items"] = extracted_items
        self.state.data["chat_history"] = chat_history
        
        # ── Calculate total ──
        total_amount = sum(
            item.get("amount", 0) * item.get("quantity", 1)
            for item in extracted_items
        )
        
        # ── Handle completion ──
        if completion_detected and len(extracted_items) > 0:
            # User wants to save — move to saving step
            self.state.current_step = "saving"
            return await self._saving_step({})
        
        # ── Handle no items yet after completion signal ──
        if completion_detected and len(extracted_items) == 0:
            error_text = AUDIO_ERROR_MESSAGES["no_items"]
            audio_path = await self.tts.generate_audio(
                error_text,
                f"audio_no_items_{self.state.session_id}.mp3"
            )
            
            self.state.current_step = "listening"
            
            return {
                "next_step": "listening",
                "message": error_text,
                "audio_url": f"/{audio_path}".replace("\\", "/") if audio_path else None,
                "data": {
                    "extracted_items": extracted_items,
                    "chat_history": chat_history,
                    "total_amount": 0
                },
                "is_complete": False
            }
        
        # ── Generate summary audio ──
        if clarification:
            # LLM needs clarification — use its question
            response_text = clarification
        elif summary_urdu:
            # Use LLM's summary
            response_text = summary_urdu
        else:
            # Fallback: generate a confirmation prompt
            response_text = await self._generate_confirmation_text(extracted_items, transaction_type, total_amount)
        
        audio_path = await self.tts.generate_audio(
            response_text,
            f"audio_summary_{self.state.session_id}.mp3"
        )
        
        self.state.current_step = "listening"
        
        return {
            "next_step": "listening",
            "message": response_text,
            "audio_url": f"/{audio_path}".replace("\\", "/") if audio_path else None,
            "data": {
                "extracted_items": extracted_items,
                "chat_history": chat_history,
                "total_amount": total_amount,
                "new_items_count": len(new_items),
                "edits_count": len(edits),
                "removals_count": len(removals),
                "completion_detected": False,
                "clarification_needed": clarification
            },
            "is_complete": False
        }
    
    # ─────────────────────────────────────────────
    # Step 4: SAVING — DB + Inventory
    # ─────────────────────────────────────────────
    
    async def _saving_step(self, user_input: Dict[str, Any]) -> Dict[str, Any]:
        """Save all extracted items to database and update inventory."""
        
        user_id = self.state.data.get("user_id")
        items = self.state.data.get("extracted_items", [])
        tx_type = self.state.data.get("transaction_type", "expense")
        
        if not items:
            error_text = AUDIO_ERROR_MESSAGES["no_items"]
            audio_path = await self.tts.generate_audio(
                error_text,
                f"audio_no_items_save_{self.state.session_id}.mp3"
            )
            
            self.state.current_step = "listening"
            
            return {
                "next_step": "listening",
                "message": error_text,
                "audio_url": f"/{audio_path}".replace("\\", "/") if audio_path else None,
                "data": {
                    "extracted_items": items,
                    "chat_history": self.state.data.get("chat_history", [])
                },
                "is_complete": False
            }
        
        try:
            # ── Save transactions to DB ──
            transaction_ids = []
            for item in items:
                result = supabase.table("transactions").insert({
                    "user_id": user_id,
                    "amount": item.get("amount", 0),
                    "type": tx_type,
                    "category": item.get("category", "General"),
                    "customer_name": item.get("customer_name", "Cash Customer"),
                    "description": item.get("description", item.get("item_name", "")),
                    "transaction_date": str(date.today()),
                    "source": "audio"
                }).execute()
                
                if result.data:
                    transaction_ids.append(result.data[0]["id"])
            
            # ── Update inventory ──
            inventory_updates = await self.inventory.update_inventory_for_items(
                user_id=user_id,
                items=items,
                transaction_type=tx_type
            )
            
            # ── Generate success audio ──
            total_amount = sum(
                item.get("amount", 0) * item.get("quantity", 1)
                for item in items
            )
            
            success_text = AUDIO_SUCCESS_MESSAGE.format(
                count=len(items),
                total=total_amount
            )
            
            audio_path = await self.tts.generate_audio(
                success_text,
                f"audio_success_{self.state.session_id}.mp3"
            )
            
            self.state.current_step = "complete"
            
            return {
                "next_step": "complete",
                "message": success_text,
                "audio_url": f"/{audio_path}".replace("\\", "/") if audio_path else None,
                "data": {
                    "transaction_ids": transaction_ids,
                    "inventory_updates": inventory_updates,
                    "items_saved": items,
                    "total_amount": total_amount,
                    "chat_history": self.state.data.get("chat_history", [])
                },
                "is_complete": True
            }
        
        except Exception as e:
            print(f"❌ Save error: {e}")
            error_text = AUDIO_ERROR_MESSAGES["save_failed"]
            audio_path = await self.tts.generate_audio(
                error_text,
                f"audio_save_error_{self.state.session_id}.mp3"
            )
            
            return {
                "next_step": "error",
                "message": f"{error_text} ({str(e)})",
                "audio_url": f"/{audio_path}".replace("\\", "/") if audio_path else None,
                "data": {},
                "is_complete": False
            }
    
    # ─────────────────────────────────────────────
    # Helper: Generate confirmation text via LLM
    # ─────────────────────────────────────────────
    
    async def _generate_confirmation_text(
        self,
        items: List[Dict],
        transaction_type: str,
        total_amount: float
    ) -> str:
        """Generate natural Urdu confirmation message using LLM."""
        
        try:
            prompt = AUDIO_CONFIRMATION_PROMPT.format(
                items_json=json.dumps(items, ensure_ascii=False),
                transaction_type=transaction_type,
                total_amount=total_amount
            )
            
            urdu_text = await self.llm.groq.generate_text(prompt, temperature=0.5)
            return self.llm._clean_urdu_text(urdu_text)
        except Exception:
            # Fallback: simple summary
            item_count = len(items)
            return f"میں نے {item_count} آئٹمز سمجھے۔ کل {total_amount} روپے۔ کیا درست ہے؟"

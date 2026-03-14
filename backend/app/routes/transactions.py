from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Dict, Any, Optional
from app.workflows.base import WorkflowState
from app.workflows.manual_entry import ManualEntryWorkflow
from app.workflows.image_entry import ImageEntryWorkflow  
from app.services.llm.orchestrator import LLMOrchestrator
from app.database import supabase
from datetime import datetime
from app.config import UPLOAD_DIR  
import json
import os

router = APIRouter(prefix="/transactions", tags=["transactions"])

# In-memory workflow storage
active_workflows: Dict[str, WorkflowState] = {}

# ==========================================
# MANUAL ENTRY ENDPOINTS
# ==========================================

@router.post("/manual/start")
async def start_manual_entry(
    user_id: str = Form(...),
    amount: float = Form(...),
    type: str = Form(...),
    category: str = Form(...),
    customer_name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    transaction_date: Optional[str] = Form(None)
):
    """Start manual transaction entry workflow."""
    
    tx_data = {
        "user_id": user_id,
        "amount": amount,
        "type": type,
        "category": category,
        "customer_name": customer_name or "Cash Customer",
        "description": description or "",
        "transaction_date": transaction_date or str(datetime.now().date()),
        "source": "manual"
    }
    
    state = WorkflowState(workflow_type="manual_entry")
    workflow = ManualEntryWorkflow(state)
    
    active_workflows[state.session_id] = state
    
    result = await workflow.execute_step("preview", tx_data)
    
    active_workflows[state.session_id] = state
    
    return {
        "session_id": state.session_id,
        **result
    }

@router.post("/manual/continue")
async def continue_manual_entry(
    session_id: str = Form(...),
    action: str = Form(...),
    corrections: Optional[str] = Form(None)
):
    """Continue manual entry workflow (edit or confirm)."""
    
    if session_id not in active_workflows:
        raise HTTPException(status_code=404, detail="Session expired or not found")
    
    state = active_workflows[session_id]
    
    if state.is_expired():
        del active_workflows[session_id]
        raise HTTPException(status_code=410, detail="Session expired")
    
    workflow = ManualEntryWorkflow(state)
    
    current_step = state.current_step
    
    user_input = {"action": action}
    if corrections:
        try:
            user_input["corrections"] = json.loads(corrections)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid corrections JSON")
    
    result = await workflow.execute_step(current_step, user_input)
    
    if result["is_complete"]:
        del active_workflows[session_id]
    else:
        state.current_step = result.get("next_step", state.current_step)
        active_workflows[session_id] = state
    
    return {
        "session_id": session_id,
        **result
    }

# ==========================================
# IMAGE ENTRY ENDPOINTS 
# ==========================================

@router.post("/image/scan")
async def scan_receipt_image(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    type: str = Form(...)  # NEW: income or expense from frontend button
):
    """
    Scan receipt image and extract items.
    User selects income/expense BEFORE uploading.
    """
    
    # Validate file
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Read image
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")
    
    # Save image temporarily (optional)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    image_path = os.path.join(UPLOAD_DIR, f"receipt_{user_id}_{int(datetime.now().timestamp())}.jpg")
    with open(image_path, "wb") as f:
        f.write(contents)
    
    # Create workflow state with ImageEntryWorkflow (FIXED!)
    state = WorkflowState(workflow_type="image_entry")
    workflow = ImageEntryWorkflow(state)  
    
    active_workflows[state.session_id] = state
    
    # Execute scan step
    user_input = {
        "image_bytes": contents,
        "user_id": user_id,
        "type": type  # Use the type from frontend
    }
    
    result = await workflow.execute_step("scan_image", user_input)
    
    active_workflows[state.session_id] = state
    
    return {
        "session_id": state.session_id,
        **result
    }

@router.post("/image/continue")  # NEW ENDPOINT
async def continue_image_entry(
    session_id: str = Form(...),
    action: str = Form(...),
    item_index: Optional[int] = Form(None),
    corrections: Optional[str] = Form(None),
    confirm: Optional[bool] = Form(None)
):
    """Continue image entry workflow (edit/confirm items)."""
    
    if session_id not in active_workflows:
        raise HTTPException(status_code=404, detail="Session expired or not found")
    
    state = active_workflows[session_id]
    
    if state.is_expired():
        del active_workflows[session_id]
        raise HTTPException(status_code=410, detail="Session expired")
    
    workflow = ImageEntryWorkflow(state)  # Use ImageEntryWorkflow
    
    # Build user input
    user_input = {"action": action}
    if item_index is not None:
        user_input["item_index"] = item_index
    if corrections:
        try:
            user_input["corrections"] = json.loads(corrections)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid corrections JSON")
    if confirm is not None:
        user_input["confirm"] = confirm
    
    # Execute workflow step
    result = await workflow.execute_step(state.current_step, user_input)
    
    # Update or remove state
    if result["is_complete"]:
        del active_workflows[session_id]
    else:
        state.current_step = result.get("next_step", state.current_step)
        active_workflows[session_id] = state
    
    return {
        "session_id": session_id,
        **result
    }

# ==========================================
# LIST ENDPOINTS 
# ==========================================

@router.get("/list")
async def list_transactions(user_id: str):
    """Get all transactions for a user."""
    
    result = supabase.table("transactions")\
        .select("*")\
        .eq("user_id", user_id)\
        .order("transaction_date", desc=True)\
        .execute()
    
    return {"transactions": result.data}
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Dict, Any, Optional
from app.workflows.base import WorkflowState
from app.workflows.manual_entry import ManualEntryWorkflow
from app.workflows.image_entry import ImageEntryWorkflow  
from app.workflows.audio_entry import AudioEntryWorkflow
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
    transaction_date: Optional[str] = Form(None),
    item_name: Optional[str] = Form(None),
    quantity: Optional[int] = Form(None)
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
        "source": "manual",
        "item_name": item_name,
        "quantity": quantity
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
    try:
        result = await workflow.execute_step(state.current_step, user_input)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    
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
# AUDIO ENTRY ENDPOINTS
# ==========================================

@router.post("/audio/start")
async def start_audio_entry(
    user_id: str = Form(...),
    type: str = Form(...)  # "income" or "expense"
):
    """
    Start an audio data entry session.
    
    The user selects income/expense on the frontend, then this endpoint
    initializes the session and returns a welcome audio prompt in Urdu.
    """
    
    # Validate type
    if type not in ["income", "expense"]:
        raise HTTPException(status_code=400, detail="Type must be 'income' or 'expense'")
    
    # Create workflow state
    state = WorkflowState(workflow_type="audio_entry")
    workflow = AudioEntryWorkflow(state)
    
    active_workflows[state.session_id] = state
    
    # Execute start step
    result = await workflow.execute_step("start", {
        "user_id": user_id,
        "type": type
    })
    
    active_workflows[state.session_id] = state
    
    return {
        "session_id": state.session_id,
        **result
    }

@router.post("/audio/continue")
async def continue_audio_entry(
    session_id: str = Form(...),
    audio_file: Optional[UploadFile] = File(None),
    user_text: Optional[str] = Form(None)
):
    """
    Continue an audio data entry session.
    
    Send either:
    - audio_file: Audio recording to transcribe (STT) and process
    - user_text: Pre-transcribed text (if frontend does STT)
    
    Returns extracted items, chat history, summary audio, and completion status.
    """
    
    if session_id not in active_workflows:
        raise HTTPException(status_code=404, detail="Session expired or not found")
    
    state = active_workflows[session_id]
    
    if state.is_expired():
        del active_workflows[session_id]
        raise HTTPException(status_code=410, detail="Session expired")
    
    workflow = AudioEntryWorkflow(state)
    
    # Build user input
    user_input = {}
    
    # Handle audio file upload
    if audio_file and audio_file.filename:
        contents = await audio_file.read()
        if contents:
            os.makedirs(UPLOAD_DIR, exist_ok=True)
            audio_path = os.path.join(
                UPLOAD_DIR,
                f"audio_{session_id}_{int(datetime.now().timestamp())}.wav"
            )
            with open(audio_path, "wb") as f:
                f.write(contents)
            user_input["audio_file_path"] = audio_path
    
    # Handle text input
    if user_text:
        user_input["user_text"] = user_text
    
    if not user_input:
        raise HTTPException(
            status_code=400,
            detail="Either audio_file or user_text is required"
        )
    
    # Execute workflow step
    try:
        result = await workflow.execute_step(state.current_step, user_input)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    
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
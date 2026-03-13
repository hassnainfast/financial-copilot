from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Dict, Any, Optional
from app.workflows.base import WorkflowState
from app.workflows.manual_entry import ManualEntryWorkflow
from app.services.llm.orchestrator import LLMOrchestrator
from app.database import supabase
from datetime import date
import json

router = APIRouter(prefix="/transactions", tags=["transactions"])

# In-memory workflow storage (upgrade to Redis/Supabase later)
active_workflows: Dict[str, WorkflowState] = {}

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
    """
    Start manual transaction entry workflow.
    Returns preview with audio confirmation.
    """
    
    # Prepare transaction data
    tx_data = {
        "user_id": user_id,
        "amount": amount,
        "type": type,
        "category": category,
        "customer_name": customer_name or "Cash Customer",
        "description": description or "",
        "transaction_date": transaction_date or str(date.today()),
        "source": "manual"
    }
    
    # Create workflow state
    state = WorkflowState(workflow_type="manual_entry")
    workflow = ManualEntryWorkflow(state)
    
    # Store state
    active_workflows[state.session_id] = state
    
    # Execute first step (preview)
    result = await workflow.execute_step("preview", tx_data)
    
    # Update stored state
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
    
    # Get workflow state
    if session_id not in active_workflows:
        raise HTTPException(status_code=404, detail="Session expired or not found")
    
    state = active_workflows[session_id]
    
    # Check if expired
    if state.is_expired():
        del active_workflows[session_id]
        raise HTTPException(status_code=410, detail="Session expired")
    
    workflow = ManualEntryWorkflow(state)
    
    # ⚠️ FIX: Determine the correct step to execute based on state, not user input
    current_step = state.current_step
    
    # Parse corrections if provided
    user_input = {"action": action}
    if corrections:
        try:
            user_input["corrections"] = json.loads(corrections)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid corrections JSON")
    
    # Execute workflow step
    result = await workflow.execute_step(current_step, user_input)
    
    # Update or remove state
    if result["is_complete"]:
        del active_workflows[session_id]
    else:
        # Update state with new current_step from result
        state.current_step = result.get("next_step", state.current_step)
        active_workflows[session_id] = state
    
    return {
        "session_id": session_id,
        **result
    }

@router.post("/image/scan")
async def scan_receipt_image(
    file: UploadFile = File(...),
    user_id: str = Form(...)
):
    """
    Scan receipt image and extract transaction data.
    Uses Gemini Vision for image analysis.
    """
    
    # Read image
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")
    
    # Use LLM orchestrator to analyze image
    llm = LLMOrchestrator()
    
    try:
        transactions = await llm.analyze_receipt(contents)
        
        if not transactions:
            raise HTTPException(status_code=400, detail="No transactions found in image")
        
        # Return first transaction for confirmation
        tx_data = transactions[0]
        tx_data["user_id"] = user_id
        tx_data["source"] = "image"
        
        # Create workflow state
        state = WorkflowState(workflow_type="image_entry")
        workflow = ManualEntryWorkflow(state)
        
        # Store state
        active_workflows[state.session_id] = state
        
        # Execute preview step
        result = await workflow.execute_step("preview", tx_data)
        
        return {
            "session_id": state.session_id,
            "extracted_items": len(transactions),
            "all_items": transactions,
            **result
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image analysis failed: {str(e)}")

@router.get("/list")
async def list_transactions(user_id: str):
    """Get all transactions for a user."""
    
    result = supabase.table("transactions")\
        .select("*")\
        .eq("user_id", user_id)\
        .order("transaction_date", desc=True)\
        .execute()
    
    return {"transactions": result.data}
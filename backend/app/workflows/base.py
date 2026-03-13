from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from uuid import uuid4
from datetime import datetime, timedelta
from app.config import WORKFLOW_TTL_SECONDS

class WorkflowState:
    """Represents the current state of a workflow."""
    
    def __init__(self, workflow_type: str, session_id: str = None):
        self.session_id = session_id or str(uuid4())
        self.workflow_type = workflow_type
        self.current_step = "start"
        self.data: Dict[str, Any] = {}
        self.created_at = datetime.utcnow()
        self.expires_at = self.created_at + timedelta(seconds=WORKFLOW_TTL_SECONDS)
    
    def is_expired(self) -> bool:
        """Check if workflow session has expired."""
        return datetime.utcnow() > self.expires_at
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert state to dictionary."""
        return {
            "session_id": self.session_id,
            "workflow_type": self.workflow_type,
            "current_step": self.current_step,
            "data": self.data,
            "expires_at": self.expires_at.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "WorkflowState":
        """Create state from dictionary."""
        state = cls(data["workflow_type"], data["session_id"])
        state.current_step = data["current_step"]
        state.data = data["data"]
        state.created_at = datetime.fromisoformat(data.get("created_at", datetime.utcnow().isoformat()))
        state.expires_at = datetime.fromisoformat(data["expires_at"])
        return state

class BaseWorkflow(ABC):
    """Abstract base class for all workflows."""
    
    def __init__(self, state: WorkflowState):
        self.state = state
    
    @abstractmethod
    async def execute_step(self, step: str, user_input: Any) -> Dict[str, Any]:
        """
        Execute a workflow step.
        
        Args:
            step: Current step name
            user_input: User's response/input
        
        Returns:
            Dict with: next_step, message, audio_url, data, is_complete
        """
        pass
    
    def get_state(self) -> Dict[str, Any]:
        """Get current workflow state."""
        return self.state.to_dict()
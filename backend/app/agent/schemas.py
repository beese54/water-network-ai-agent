from pydantic import BaseModel
from typing import List, Optional, Any
from app.models.simulation import AffectedNode


class ToolCallRecord(BaseModel):
    tool: str
    input: dict
    output: Any


class ChatRequest(BaseModel):
    session_id: str
    message: str
    auto_run_simulation: bool = True


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    tool_calls: List[ToolCallRecord] = []
    affected_nodes: List[AffectedNode] = []
    network_state_changed: bool = False

import traceback
import logging

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_simulation_state

logger = logging.getLogger(__name__)
from app.simulation.state import SimulationState
from app.agent.schemas import ChatRequest, ChatResponse
from app.agent.orchestrator import handle_message, clear_session
from app.config import settings

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    state: SimulationState = Depends(get_simulation_state),
):
    """Handle a conversational message from the engineer. Runs the full agentic loop."""
    provider = settings.llm_provider.lower()
    if provider == "anthropic" and not settings.anthropic_api_key:
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY is not configured.")
    if provider == "together" and not settings.together_api_key:
        raise HTTPException(status_code=503, detail="TOGETHER_API_KEY is not configured.")
    if provider == "openai" and not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is not configured.")
    try:
        return await handle_message(request, state)
    except Exception as exc:
        logger.error("Agent chat error:\n%s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.delete("/chat/{session_id}")
async def delete_session(session_id: str):
    """Clear conversation history for a session."""
    clear_session(session_id)
    return {"status": "cleared", "session_id": session_id}

import time
from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_simulation_state
from app.simulation.state import SimulationState
from app.simulation.engine import run_simulation
from app.simulation.results import parse_results
from app.models.simulation import (
    SimulationResult, AffectedNode,
    ShutdownAnalysisRequest, ShutdownAnalysisResult,
)
from app.simulation.shutdown_analysis import run_shutdown_analysis
from app.models.network import PipeOperationRequest, PipeOperationResponse
from app.network.topology import generate_network_data
from app.config import settings

router = APIRouter(prefix="/simulation", tags=["simulation"])


@router.post("/run", response_model=SimulationResult)
async def run_sim(state: SimulationState = Depends(get_simulation_state)):
    """Run the hydraulic simulation with current network state and return results."""
    t0 = time.time()
    # Use PDA when pipes are closed so isolated-node demands don't distort live-network flows
    use_pda = len(state.closed_pipes) > 0
    wntr_results, error = run_simulation(state.wn, use_pda=use_pda)
    if error:
        raise HTTPException(status_code=500, detail=f"Simulation failed: {error}")

    duration_ms = int((time.time() - t0) * 1000)
    data = generate_network_data()
    result = parse_results(wntr_results, data, duration_ms=duration_ms)
    await state.store_results(result)
    return result


@router.get("/results", response_model=SimulationResult)
async def get_results(state: SimulationState = Depends(get_simulation_state)):
    """Return the most recent simulation results."""
    if state.last_results is None:
        raise HTTPException(
            status_code=409,
            detail="No simulation results available. Run POST /simulation/run first."
        )
    return state.last_results


@router.post("/pipes/close", response_model=PipeOperationResponse)
async def close_pipes(
    body: PipeOperationRequest,
    state: SimulationState = Depends(get_simulation_state),
):
    """Close one or more pipes directly (non-agent path)."""
    result = await state.close_pipes(body.pipe_ids)
    if result["not_found"]:
        raise HTTPException(
            status_code=422,
            detail=f"Pipe IDs not found: {result['not_found']}",
        )
    return PipeOperationResponse(
        success=result["closed"],
        not_found=result["not_found"],
        already_in_state=result["already_closed"],
    )


@router.post("/pipes/open", response_model=PipeOperationResponse)
async def open_pipes(
    body: PipeOperationRequest,
    state: SimulationState = Depends(get_simulation_state),
):
    """Reopen one or more closed pipes."""
    result = await state.open_pipes(body.pipe_ids)
    if result["not_found"]:
        raise HTTPException(
            status_code=422,
            detail=f"Pipe IDs not found: {result['not_found']}",
        )
    return PipeOperationResponse(
        success=result["opened"],
        not_found=result["not_found"],
        already_in_state=result["already_open"],
    )


@router.post("/shutdown-analysis", response_model=ShutdownAnalysisResult)
async def shutdown_analysis(body: ShutdownAnalysisRequest):
    """Run baseline + shutdown simulations and return 24h comparison data."""
    try:
        result_dict = run_shutdown_analysis(body.pipe_ids)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return ShutdownAnalysisResult(
        **result_dict,
        start_datetime=body.start_datetime,
        end_datetime=body.end_datetime,
    )

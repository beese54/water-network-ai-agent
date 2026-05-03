"""
Agent tool implementations.

Each function corresponds to a Claude API tool definition.
They read/write from SimulationState and return JSON-serialisable dicts.
"""

import time
from typing import Optional

from app.simulation.state import SimulationState
from app.simulation.engine import run_simulation
from app.simulation.results import parse_results
from app.network.topology import generate_network_data
from app.network.zones import get_zone_display_name, ZONE_DEFINITIONS
from app.config import settings


# Cached network metadata (loaded once)
_network_data = None

def _get_network_data():
    global _network_data
    if _network_data is None:
        _network_data = generate_network_data()
    return _network_data


# ---------------------------------------------------------------------------
# Tool: list_pipes
# ---------------------------------------------------------------------------

async def tool_list_pipes(state: SimulationState, zone: Optional[str] = None,
                          status_filter: str = "all") -> dict:
    """Return all pipes with metadata, optionally filtered by zone or status."""
    data = _get_network_data()
    closed = state.closed_pipes

    # Build zone membership for pipes (pipe belongs to zone if both nodes are in zone)
    node_zone: dict = {n["id"]: n.get("zone") for n in data["nodes"]}
    node_zone["R001"] = "reservoir"

    pipes = []
    for p in data["pipes"]:
        pipe_status = "closed" if p["id"] in closed else "open"

        # Filter by status
        if status_filter == "open" and pipe_status != "open":
            continue
        if status_filter == "closed" and pipe_status != "closed":
            continue

        # Determine dominant zone of pipe
        z1 = node_zone.get(p["start_node"])
        z2 = node_zone.get(p["end_node"])
        pipe_zone = z1 if z1 == z2 else "cross-zone"

        # Filter by zone
        if zone and zone not in (z1, z2, "cross-zone"):
            continue
        if zone == "cross-zone" and pipe_zone != "cross-zone":
            continue

        pipes.append({
            "id": p["id"],
            "start_node": p["start_node"],
            "end_node": p["end_node"],
            "length_m": p["length_m"],
            "diameter_mm": p["diameter_mm"],
            "category": p["category"],
            "road_name": p.get("road_name", ""),
            "zone": pipe_zone,
            "status": pipe_status,
        })

    return {"pipe_count": len(pipes), "pipes": pipes}


# ---------------------------------------------------------------------------
# Tool: list_nodes
# ---------------------------------------------------------------------------

async def tool_list_nodes(state: SimulationState, zone: Optional[str] = None) -> dict:
    """Return all junction nodes with metadata."""
    data = _get_network_data()

    nodes = []
    for n in data["nodes"]:
        if zone and n.get("zone") != zone:
            continue
        nodes.append({
            "id": n["id"],
            "lat": n["lat"],
            "lon": n["lon"],
            "elevation_m": n["elevation_m"],
            "base_demand_lps": n["base_demand_lps"],
            "zone": n.get("zone"),
            "zone_display": get_zone_display_name(n.get("zone", "")),
        })

    return {"node_count": len(nodes), "nodes": nodes}


# ---------------------------------------------------------------------------
# Tool: shutdown_pipes
# ---------------------------------------------------------------------------

async def tool_shutdown_pipes(state: SimulationState, pipe_ids: list) -> dict:
    """Close pipes to simulate emergency shutdown."""
    result = await state.close_pipes(pipe_ids)
    message = (
        f"{len(result['closed'])} pipe(s) closed: {result['closed']}. "
        f"Call run_simulation() to see the hydraulic impact."
    )
    if result["not_found"]:
        message += f" Pipe IDs not found: {result['not_found']}."
    if result["already_closed"]:
        message += f" Already closed: {result['already_closed']}."
    return {**result, "message": message, "network_state_changed": bool(result["closed"])}


# ---------------------------------------------------------------------------
# Tool: run_simulation
# ---------------------------------------------------------------------------

async def tool_run_simulation(
    state: SimulationState,
    demand_hour: int | None = None,
) -> dict:
    """Run the hydraulic simulation with current network state (PDA when pipes are closed)."""
    t0 = time.time()
    use_pda = len(state.closed_pipes) > 0
    wntr_results, error = run_simulation(
        state.wn, use_pda=use_pda, single_step=True, demand_hour=demand_hour,
    )
    duration_ms = int((time.time() - t0) * 1000)

    if error:
        return {"status": "error", "message": error}

    data = _get_network_data()
    sim_result = parse_results(wntr_results, data, duration_ms=duration_ms)
    await state.store_results(sim_result)

    # Build a human-readable label for the demand hour used
    if demand_hour is not None:
        demand_label = f"{demand_hour:02d}:00"
        if demand_hour == 7:
            demand_label += " (morning peak — worst case)"
        elif demand_hour == 8:
            demand_label += " (morning peak)"
    else:
        demand_label = "00:00 (midnight baseline)"

    return {
        "status": "success",
        "simulation_id": sim_result.simulation_id,
        "duration_ms": duration_ms,
        "demand_hour": demand_hour,
        "demand_hour_label": demand_label,
        "nodes_below_threshold": sim_result.summary.nodes_below_threshold,
        "threshold_bar": sim_result.summary.threshold_bar,
        "min_pressure_bar": sim_result.summary.min_pressure_bar,
        "max_pressure_bar": sim_result.summary.max_pressure_bar,
        "avg_pressure_bar": sim_result.summary.avg_pressure_bar,
        "total_nodes": sim_result.summary.total_nodes,
    }


# ---------------------------------------------------------------------------
# Tool: get_affected_nodes
# ---------------------------------------------------------------------------

async def tool_get_affected_nodes(
    state: SimulationState,
    threshold_m: float = None,
    zone: Optional[str] = None,
) -> dict:
    """Return nodes where pressure is below the threshold after the last simulation."""
    if threshold_m is None:
        threshold_m = settings.min_residual_head_m

    results = state.last_results
    if results is None:
        return {
            "error": "No simulation results available. Call run_simulation() first.",
            "affected_count": 0,
            "nodes": [],
        }

    affected = []
    for nr in results.node_results:
        if nr.below_threshold:
            if zone and nr.zone != zone:
                continue
            affected.append({
                "node_id": nr.node_id,
                "pressure_bar": nr.pressure_bar,
                "head_m": nr.head_m,
                "lat": nr.lat,
                "lon": nr.lon,
                "elevation_m": nr.elevation_m,
                "zone": nr.zone,
                "zone_display": get_zone_display_name(nr.zone or ""),
            })

    # Sort by pressure ascending (most affected first)
    affected.sort(key=lambda x: x["pressure_bar"])

    # Group by zone for summary
    by_zone: dict = {}
    for n in affected:
        z = n["zone_display"] or n["zone"] or "Unknown"
        if z not in by_zone:
            by_zone[z] = {"count": 0, "min_pressure_bar": float("inf")}
        by_zone[z]["count"] += 1
        by_zone[z]["min_pressure_bar"] = min(by_zone[z]["min_pressure_bar"], n["pressure_bar"])

    return {
        "affected_count": len(affected),
        "threshold_bar": round(threshold_m / 10.197, 3),
        "zone_summary": by_zone,
        "nodes": affected,
    }


# ---------------------------------------------------------------------------
# Tool: get_network_status
# ---------------------------------------------------------------------------

async def tool_get_network_status(state: SimulationState) -> dict:
    """Return current operational status of the network."""
    data = _get_network_data()
    closed = list(state.closed_pipes)
    total_pipes = len(data["pipes"])

    return {
        "reservoir_id": "R001",
        "reservoir_head_m": 145.0,
        "total_pipes": total_pipes,
        "open_pipes": total_pipes - len(closed),
        "closed_pipes": closed,
        "closed_pipe_count": len(closed),
        "simulation_results_valid": state.results_valid,
        "last_simulation_id": state.last_results.simulation_id if state.last_results else None,
    }

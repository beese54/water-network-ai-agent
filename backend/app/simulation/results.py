"""
Simulation result parsing and transformation.

Converts raw WNTR simulation results into Pydantic response models,
annotated with zone information and threshold flags.
"""

import time
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any

from app.models.simulation import (
    NodeResult, PipeResult, SimulationSummary, SimulationResult,
    HourlyPressureSummary, HourlyFlowSummary,
)
from app.network.topology import generate_network_data
from app.network.zones import get_zone_display_name
from app.config import settings


def _build_node_lookup(network_data: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """Build a quick lookup dict: node_id → {lat, lon, elevation_m, zone}."""
    lookup = {}
    for node in network_data["nodes"]:
        lookup[node["id"]] = node
    return lookup


def _build_pipe_lookup(network_data: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """Build a quick lookup dict: pipe_id → pipe metadata."""
    lookup = {}
    for pipe in network_data["pipes"]:
        lookup[pipe["id"]] = pipe
    return lookup


def parse_results(
    wntr_results,
    network_data: Dict[str, Any],
    threshold_m: float = None,
    duration_ms: int = 0,
) -> SimulationResult:
    """
    Parse WNTR simulation results into a SimulationResult Pydantic model.

    Args:
        wntr_results: WNTR SimulationResults object
        network_data: output of generate_network_data()
        threshold_m: pressure threshold in metres (defaults to config value)
        duration_ms: simulation wall-clock time in milliseconds
    """
    if threshold_m is None:
        threshold_m = settings.min_residual_head_m

    node_lookup = _build_node_lookup(network_data)
    pipe_lookup = _build_pipe_lookup(network_data)

    # Use time step 0 (first hour = representative steady-state)
    pressure_df = wntr_results.node["pressure"]
    demand_df = wntr_results.node["demand"]
    head_df = wntr_results.node["head"]
    flow_df = wntr_results.link["flowrate"]
    velocity_df = wntr_results.link["velocity"]

    t = pressure_df.index[0]  # First time step
    BAR = 10.197

    # ------------------------------------------------------------------
    # Node results
    # ------------------------------------------------------------------
    node_results: List[NodeResult] = []
    for node_id in pressure_df.columns:
        if node_id == "R001":
            continue  # Skip reservoir

        pressure = float(pressure_df.loc[t, node_id])
        head = float(head_df.loc[t, node_id])
        demand_m3s = float(demand_df.loc[t, node_id])
        demand_lps = demand_m3s * 1000.0  # m³/s → L/s

        meta = node_lookup.get(node_id, {})
        zone_id = meta.get("zone", "unknown")

        node_results.append(NodeResult(
            node_id=node_id,
            pressure_bar=round(pressure / BAR, 3),
            head_m=round(head, 3),
            demand_lps=round(demand_lps, 4),
            lat=meta.get("lat", 0.0),
            lon=meta.get("lon", 0.0),
            elevation_m=meta.get("elevation_m", 0.0),
            zone=zone_id,
            below_threshold=pressure < threshold_m,
        ))

    # ------------------------------------------------------------------
    # Pipe results
    # ------------------------------------------------------------------
    pipe_results: List[PipeResult] = []
    for pipe_id in flow_df.columns:
        flow_m3s = float(flow_df.loc[t, pipe_id])
        flow_lps = flow_m3s * 1000.0
        velocity = float(velocity_df.loc[t, pipe_id])

        meta = pipe_lookup.get(pipe_id, {})
        status = "closed" if meta.get("status") == "closed" else "open"

        pipe_results.append(PipeResult(
            pipe_id=pipe_id,
            flow_lps=round(flow_lps, 4),
            velocity_mps=round(velocity, 4),
            status=status,
        ))

    # ------------------------------------------------------------------
    # Summary statistics
    # ------------------------------------------------------------------
    junction_pressures_bar = [nr.pressure_bar for nr in node_results]
    nodes_below = sum(1 for nr in node_results if nr.below_threshold)

    summary = SimulationSummary(
        min_pressure_bar=round(min(junction_pressures_bar), 3),
        max_pressure_bar=round(max(junction_pressures_bar), 3),
        avg_pressure_bar=round(sum(junction_pressures_bar) / len(junction_pressures_bar), 3),
        nodes_below_threshold=nodes_below,
        threshold_bar=round(threshold_m / BAR, 3),
        total_nodes=len(junction_pressures_bar),
    )

    return SimulationResult(
        status="success",
        simulation_id=f"sim_{uuid.uuid4().hex[:8]}",
        duration_ms=duration_ms,
        node_results=node_results,
        pipe_results=pipe_results,
        summary=summary,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


def extract_hourly_summaries(
    wntr_results,
    pipe_ids_of_interest: List[str],
    threshold_m: float = None,
) -> Dict[str, Any]:
    """Extract pressure network summaries and pipe flows for all 24 hourly timesteps."""
    from app.network.topology import DEMAND_PATTERN_24H

    if threshold_m is None:
        threshold_m = settings.min_residual_head_m

    BAR = 10.197
    pressure_df = wntr_results.node["pressure"]
    flow_df     = wntr_results.link["flowrate"]
    velocity_df = wntr_results.link["velocity"]
    junctions   = [c for c in pressure_df.columns if c != "R001"]

    pressure_summaries: List[HourlyPressureSummary] = []
    flow_summaries: List[HourlyFlowSummary] = []

    for i, t in enumerate(pressure_df.index):
        if i >= 24:
            break  # WNTR produces 25 timesteps (0–24h); only use 24
        hour = i
        # Clamp extreme negatives to 0: isolated nodes have no service (DDA artifact)
        pressures = [max(float(pressure_df.loc[t, n]), 0.0) for n in junctions]
        pressure_summaries.append(HourlyPressureSummary(
            hour=hour,
            demand_multiplier=DEMAND_PATTERN_24H[hour],
            avg_pressure_bar=round(sum(pressures) / len(pressures) / BAR, 3),
            min_pressure_bar=round(min(pressures) / BAR, 3),
            max_pressure_bar=round(max(pressures) / BAR, 3),
            nodes_below_threshold=sum(1 for p in pressures if p < threshold_m),
        ))
        for pid in pipe_ids_of_interest:
            if pid not in flow_df.columns:
                continue
            flow_summaries.append(HourlyFlowSummary(
                hour=hour,
                pipe_id=pid,
                flow_lps=round(float(flow_df.loc[t, pid]) * 1000.0, 4),
                velocity_mps=round(float(velocity_df.loc[t, pid]), 4),
            ))

    return {"pressure": pressure_summaries, "flow": flow_summaries}

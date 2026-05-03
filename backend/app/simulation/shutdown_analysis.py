"""
Shutdown analysis: runs baseline + shutdown simulations using fresh WaterNetworkModel
copies — never mutates shared SimulationState.
"""

import math
import time
import uuid
from collections import defaultdict
from typing import List, Dict, Any, Set

import wntr
import wntr.network

from app.simulation.engine import run_simulation
from app.simulation.results import extract_hourly_summaries
from app.network.topology import generate_network_data
from app.models.simulation import NodeImpact, PipeImpact
from app.config import settings


def run_shutdown_analysis(pipe_ids: List[str], threshold_m: float = None) -> Dict[str, Any]:
    if threshold_m is None:
        threshold_m = settings.min_residual_head_m

    t0 = time.time()
    network_data = generate_network_data()

    # Load from the pre-validated .inp file — has TRIALS/ACCURACY/UNBALANCED settings
    wn_baseline = wntr.network.WaterNetworkModel(settings.network_file_path)
    wn_shutdown = wntr.network.WaterNetworkModel(settings.network_file_path)

    # Validate pipe IDs against the loaded model
    valid_pipes = set(wn_baseline.pipe_name_list)
    not_found = [pid for pid in pipe_ids if pid not in valid_pipes]
    if not_found:
        raise ValueError(f"Pipe ID(s) not found in network: {', '.join(not_found)}")

    # --- Baseline (all pipes open) using DDA ---
    baseline_wntr, err = run_simulation(wn_baseline)
    if err:
        raise RuntimeError(f"Baseline simulation failed: {err}")

    # --- Shutdown (specified pipes closed) ---
    # Use UNBALANCED CONTINUE so isolated nodes are included (extreme pressures clamped in results.py)
    for pid in pipe_ids:
        wn_shutdown.get_link(pid).initial_status = wntr.network.LinkStatus.Closed
    wn_shutdown.options.hydraulic.unbalanced = 'CONTINUE'
    wn_shutdown.options.hydraulic.unbalanced_value = 100
    shutdown_wntr, err = run_simulation(wn_shutdown)
    if err:
        raise RuntimeError(f"Shutdown simulation failed: {err}")

    # --- Extract 24h summaries ---
    baseline_data = extract_hourly_summaries(baseline_wntr, pipe_ids, threshold_m)
    shutdown_data = extract_hourly_summaries(shutdown_wntr, pipe_ids, threshold_m)

    # --- Raw DataFrames for impact analysis ---
    b_df = baseline_wntr.node["pressure"]
    s_df = shutdown_wntr.node["pressure"]
    b_flow_df = baseline_wntr.link["flowrate"]
    s_flow_df = shutdown_wntr.link["flowrate"]
    junctions = [c for c in b_df.columns if c != "R001"]

    affected_ids = []
    for nid in junctions:
        for t in b_df.index:
            if float(b_df.loc[t, nid]) - float(s_df.loc[t, nid]) > 0.01:
                affected_ids.append(nid)
                break

    # --- Bounding box for map zoom ---
    node_lookup = {n["id"]: n for n in network_data["nodes"]}
    bbox = _compute_bbox(affected_ids, node_lookup)

    duration_ms = int((time.time() - t0) * 1000)
    max_drop = _max_pressure_drop(b_df, s_df, junctions)
    n = len(affected_ids)
    impacts = _compute_impacts(pipe_ids, b_df, s_df, b_flow_df, s_flow_df, network_data)

    return {
        "analysis_id": f"sa_{uuid.uuid4().hex[:8]}",
        "pipe_ids": pipe_ids,
        "duration_ms": duration_ms,
        "baseline_pressure": baseline_data["pressure"],
        "shutdown_pressure": shutdown_data["pressure"],
        "baseline_flow": baseline_data["flow"],
        "shutdown_flow": shutdown_data["flow"],
        "affected_node_ids": affected_ids,
        "affected_bbox": bbox,
        "summary_text": (
            f"{n} node(s) affected by closing {', '.join(pipe_ids)}. "
            f"Max pressure drop: {max_drop / 10.197:.2f} bar."
        ),
        "node_impacts": impacts["node_impacts"],
        "pipe_impacts": impacts["pipe_impacts"],
    }


def _compute_bbox(node_ids: List[str], node_lookup: Dict[str, Any]) -> List[float]:
    lats = [node_lookup[n]["lat"] for n in node_ids if n in node_lookup]
    lons = [node_lookup[n]["lon"] for n in node_ids if n in node_lookup]
    if not lats:
        return [1.346, 103.740, 1.365, 103.760]
    pad = 0.002
    return [
        round(min(lats) - pad, 6), round(min(lons) - pad, 6),
        round(max(lats) + pad, 6), round(max(lons) + pad, 6),
    ]


def _max_pressure_drop(b_df, s_df, junctions: List[str]) -> float:
    max_drop = 0.0
    for nid in junctions:
        for t in b_df.index:
            base = float(b_df.loc[t, nid])
            shut = max(float(s_df.loc[t, nid]), 0.0)  # clamp isolated-node artifacts
            drop = base - shut
            if drop > max_drop:
                max_drop = drop
    return max_drop


def _compute_impacts(
    pipe_ids: List[str],
    b_df, s_df,
    b_flow_df, s_flow_df,
    network_data: Dict[str, Any],
) -> Dict[str, Any]:
    BAR = 10.197
    pipe_id_set: Set[str] = set(pipe_ids)

    # Pick a representative hour (hour 12 — midday, demand multiplier 1.30)
    idx = min(12, len(b_df.index) - 1)
    snap = b_df.index[idx]

    # Build adjacency excluding shutdown pipes
    adj: Dict[str, set] = defaultdict(set)
    for p in network_data["pipes"]:
        if p["id"] not in pipe_id_set:
            adj[p["start_node"]].add(p["end_node"])
            adj[p["end_node"]].add(p["start_node"])

    # BFS from reservoir
    reachable: Set[str] = {"R001"}
    stack = ["R001"]
    while stack:
        node = stack.pop()
        for nb in adj[node]:
            if nb not in reachable:
                reachable.add(nb)
                stack.append(nb)

    node_lookup = {n["id"]: n for n in network_data["nodes"]}
    junctions = [c for c in b_df.columns if c != "R001"]

    node_impacts = []
    for nid in junctions:
        base_p = max(float(b_df.loc[snap, nid]), 0.0) / BAR
        shut_p = max(float(s_df.loc[snap, nid]), 0.0) / BAR
        side = "upstream" if nid in reachable else "downstream"
        nd = node_lookup.get(nid, {})
        node_impacts.append(NodeImpact(
            node_id=nid,
            lat=nd.get("lat", 0.0),
            lon=nd.get("lon", 0.0),
            elevation_m=nd.get("elevation_m", 0.0),
            zone=nd.get("zone"),
            side=side,
            depth_from_reservoir=nd.get("depth_from_reservoir", -1),
            upstream_pipe_ids=nd.get("upstream_pipe_ids", []),
            downstream_pipe_ids=nd.get("downstream_pipe_ids", []),
            baseline_pressure_bar=round(base_p, 3),
            shutdown_pressure_bar=round(shut_p, 3),
            pressure_delta_bar=round(shut_p - base_p, 3),
        ))

    pipe_impacts = []
    for p in network_data["pipes"]:
        pid = p["id"]
        if pid in pipe_id_set:
            side = "shutdown"
        elif p["start_node"] in reachable and p["end_node"] in reachable:
            side = "upstream"
        else:
            side = "downstream"

        # flowrate DataFrame is in m³/s; convert to L/s
        b_flow = float(b_flow_df.loc[snap, pid]) * 1000.0 if pid in b_flow_df.columns else 0.0
        s_flow = float(s_flow_df.loc[snap, pid]) * 1000.0 if pid in s_flow_df.columns else 0.0

        r = (p["diameter_mm"] / 1000.0) / 2.0
        area = math.pi * r * r
        b_vel = abs(b_flow / 1000.0) / area if area > 0 else 0.0
        s_vel = abs(s_flow / 1000.0) / area if area > 0 else 0.0

        pipe_impacts.append(PipeImpact(
            pipe_id=pid,
            start_node=p["start_node"],
            end_node=p["end_node"],
            category=p["category"],
            side=side,
            baseline_flow_lps=round(b_flow, 3),
            shutdown_flow_lps=round(s_flow, 3),
            flow_delta_lps=round(s_flow - b_flow, 3),
            baseline_velocity_mps=round(b_vel, 3),
            shutdown_velocity_mps=round(s_vel, 3),
            velocity_delta_mps=round(s_vel - b_vel, 3),
        ))

    return {"node_impacts": node_impacts, "pipe_impacts": pipe_impacts}

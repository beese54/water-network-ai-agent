"""
Network edit endpoints — add/delete/move nodes and pipes.

Each endpoint:
  1. Validates inputs against the live WNTR model
  2. Mutates the WNTR model in-place
  3. Persists changes to network_overrides.json
  4. Invalidates both topology caches so the next GET /topology rebuilds
  5. Returns the created/modified object
"""

from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_simulation_state
from app.simulation.state import SimulationState
from app.network.overrides import load_overrides, save_overrides
from app.network.road_topology_builder import _haversine_m
from app.models.network import NodeModel, PipeModel
import wntr.network

router = APIRouter(prefix="/network/edit", tags=["edit"])


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class AddNodeRequest(BaseModel):
    lat: float
    lon: float
    elevation_m: float = 0.0
    base_demand_lps: float = 0.05


class AddPipeRequest(BaseModel):
    start_node_id: str
    end_node_id: str
    diameter_mm: float = 100.0
    category: Literal["service", "distribution", "trunk"] = "service"


class MoveNodeRequest(BaseModel):
    lat: float
    lon: float
    elevation_m: float


class SplitPipeRequest(BaseModel):
    lat: float
    lon: float


# ---------------------------------------------------------------------------
# ID helpers
# ---------------------------------------------------------------------------

def _next_node_id(overrides: dict) -> str:
    existing = [k for k in overrides["nodes"] if k.startswith("EDIT_J")]
    if not existing:
        return "EDIT_J0001"
    nums = []
    for k in existing:
        try:
            nums.append(int(k.replace("EDIT_J", "")))
        except ValueError:
            pass
    return f"EDIT_J{max(nums) + 1:04d}" if nums else "EDIT_J0001"


def _next_pipe_id(overrides: dict, category: str) -> str:
    prefix_map = {"service": "S", "distribution": "D", "trunk": "T"}
    prefix = prefix_map.get(category, "S")
    tag = f"EDIT_{prefix}"
    existing = [k for k in overrides["pipes"] if k.startswith(tag)]
    if not existing:
        return f"{tag}0001"
    nums = []
    for k in existing:
        try:
            nums.append(int(k.replace(tag, "")))
        except ValueError:
            pass
    return f"{tag}{max(nums) + 1:04d}" if nums else f"{tag}0001"


# ---------------------------------------------------------------------------
# Cache invalidation
# ---------------------------------------------------------------------------

def _invalidate_caches(state: SimulationState) -> None:
    from app.network import topology as topology_module
    from app.api import network as network_api_module
    topology_module._cache = None
    network_api_module._topology_cache = None
    state._results_valid = False


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/node", response_model=NodeModel)
async def add_node(
    req: AddNodeRequest,
    state: SimulationState = Depends(get_simulation_state),
):
    """Add a new junction node at the given coordinates."""
    overrides = load_overrides()
    node_id = _next_node_id(overrides)

    wn = state.wn
    try:
        wn.add_junction(
            node_id,
            base_demand=req.base_demand_lps / 1000.0,
            demand_pattern="RES_PATTERN",
            elevation=req.elevation_m,
        )
        wn.get_node(node_id).coordinates = (req.lon, req.lat)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"WNTR error: {e}")

    # Determine zone
    from app.network.road_topology_builder import _assign_zone, _estimate_elevation, ZONE_DEFS
    zone = _assign_zone(req.lat, req.lon)

    node_dict = {
        "id": node_id,
        "type": "junction",
        "lat": req.lat,
        "lon": req.lon,
        "elevation_m": req.elevation_m,
        "base_demand_lps": req.base_demand_lps,
        "zone": zone,
    }
    overrides["nodes"][node_id] = node_dict
    save_overrides(overrides)
    _invalidate_caches(state)

    return NodeModel(
        id=node_id,
        type="junction",
        lat=req.lat,
        lon=req.lon,
        elevation_m=req.elevation_m,
        base_demand_lps=req.base_demand_lps,
        zone=zone,
        depth_from_reservoir=-1,
        upstream_pipe_ids=[],
        downstream_pipe_ids=[],
    )


@router.delete("/node/{node_id}")
async def delete_node(
    node_id: str,
    state: SimulationState = Depends(get_simulation_state),
):
    """Delete a node and all pipes connected to it."""
    wn = state.wn
    if node_id not in wn.node_name_list:
        raise HTTPException(status_code=404, detail=f"Node {node_id!r} not found")
    if node_id == "R001":
        raise HTTPException(status_code=400, detail="Cannot delete the reservoir node")

    # Find connected pipes before deletion
    connected_pipes = [
        pid for pid in list(wn.pipe_name_list)
        if (wn.get_link(pid).start_node_name == node_id
            or wn.get_link(pid).end_node_name == node_id)
    ]

    # Remove connected pipes first, then node
    for pid in connected_pipes:
        wn.remove_link(pid)
    wn.remove_node(node_id)

    overrides = load_overrides()

    if node_id.startswith("EDIT_"):
        overrides["nodes"].pop(node_id, None)
        # Also remove any EDIT pipes that were connected to this node
        for pid in connected_pipes:
            overrides["pipes"].pop(pid, None)
    else:
        if node_id not in overrides["deleted_node_ids"]:
            overrides["deleted_node_ids"].append(node_id)
        # Record connected non-EDIT pipes as deleted too
        for pid in connected_pipes:
            if not pid.startswith("EDIT_") and pid not in overrides["deleted_pipe_ids"]:
                overrides["deleted_pipe_ids"].append(pid)
            overrides["pipes"].pop(pid, None)

    save_overrides(overrides)
    _invalidate_caches(state)

    return {"deleted_node_id": node_id, "deleted_pipe_ids": connected_pipes}


@router.patch("/node/{node_id}/move")
async def move_node(
    node_id: str,
    req: MoveNodeRequest,
    state: SimulationState = Depends(get_simulation_state),
):
    """Move a node to new coordinates; recalculates all connected pipe lengths."""
    wn = state.wn
    if node_id not in wn.node_name_list:
        raise HTTPException(status_code=404, detail=f"Node {node_id!r} not found")

    node = wn.get_node(node_id)
    node.coordinates = (req.lon, req.lat)
    node.elevation = req.elevation_m

    # Recalculate lengths of all connected pipes
    updated_lengths: dict = {}
    for pipe_id in list(wn.pipe_name_list):
        link = wn.get_link(pipe_id)
        if link.start_node_name == node_id or link.end_node_name == node_id:
            n1 = wn.get_node(link.start_node_name)
            n2 = wn.get_node(link.end_node_name)
            new_len = _haversine_m(
                n1.coordinates[1], n1.coordinates[0],
                n2.coordinates[1], n2.coordinates[0],
            )
            link.length = max(new_len, 1.0)
            updated_lengths[pipe_id] = round(new_len, 1)

    overrides = load_overrides()
    if node_id.startswith("EDIT_"):
        if node_id in overrides["nodes"]:
            overrides["nodes"][node_id]["lat"] = req.lat
            overrides["nodes"][node_id]["lon"] = req.lon
            overrides["nodes"][node_id]["elevation_m"] = req.elevation_m
    else:
        overrides["moved_nodes"][node_id] = {
            "lat": req.lat,
            "lon": req.lon,
            "elevation_m": req.elevation_m,
        }
    # Update lengths in any matching EDIT pipes
    for pid, new_len in updated_lengths.items():
        if pid in overrides["pipes"]:
            overrides["pipes"][pid]["length_m"] = new_len

    save_overrides(overrides)
    _invalidate_caches(state)

    return {
        "node_id": node_id,
        "affected_pipe_ids": list(updated_lengths.keys()),
        "updated_lengths": updated_lengths,
    }


@router.post("/pipe", response_model=PipeModel)
async def add_pipe(
    req: AddPipeRequest,
    state: SimulationState = Depends(get_simulation_state),
):
    """Add a new pipe between two existing nodes."""
    wn = state.wn
    for nid in (req.start_node_id, req.end_node_id):
        if nid not in wn.node_name_list:
            raise HTTPException(status_code=404, detail=f"Node {nid!r} not found")

    if req.start_node_id == req.end_node_id:
        raise HTTPException(status_code=400, detail="Start and end nodes must be different")

    overrides = load_overrides()
    pipe_id = _next_pipe_id(overrides, req.category)

    n1 = wn.get_node(req.start_node_id)
    n2 = wn.get_node(req.end_node_id)
    length_m = _haversine_m(
        n1.coordinates[1], n1.coordinates[0],
        n2.coordinates[1], n2.coordinates[0],
    )
    length_m = max(length_m, 1.0)

    roughness_map = {"trunk": 120, "distribution": 120, "service": 130}
    roughness = roughness_map.get(req.category, 120)

    try:
        wn.add_pipe(
            pipe_id,
            req.start_node_id,
            req.end_node_id,
            length=length_m,
            diameter=req.diameter_mm / 1000.0,
            roughness=roughness,
            minor_loss=0.0,
            initial_status="Open",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"WNTR error: {e}")

    pipe_dict = {
        "id": pipe_id,
        "start_node": req.start_node_id,
        "end_node": req.end_node_id,
        "length_m": round(length_m, 1),
        "diameter_mm": req.diameter_mm,
        "roughness_hw": roughness,
        "category": req.category,
        "road_name": "User-defined",
        "status": "open",
    }
    overrides["pipes"][pipe_id] = pipe_dict
    save_overrides(overrides)
    _invalidate_caches(state)

    return PipeModel(
        id=pipe_id,
        start_node=req.start_node_id,
        end_node=req.end_node_id,
        length_m=round(length_m, 1),
        diameter_mm=req.diameter_mm,
        roughness_hw=roughness,
        status="open",
        category=req.category,
        road_name="User-defined",
    )


@router.delete("/pipe/{pipe_id}")
async def delete_pipe(
    pipe_id: str,
    state: SimulationState = Depends(get_simulation_state),
):
    """Delete a pipe by ID."""
    wn = state.wn
    if pipe_id not in wn.pipe_name_list:
        raise HTTPException(status_code=404, detail=f"Pipe {pipe_id!r} not found")

    wn.remove_link(pipe_id)

    overrides = load_overrides()
    if pipe_id.startswith("EDIT_"):
        overrides["pipes"].pop(pipe_id, None)
    else:
        if pipe_id not in overrides["deleted_pipe_ids"]:
            overrides["deleted_pipe_ids"].append(pipe_id)

    save_overrides(overrides)
    _invalidate_caches(state)

    return {"deleted_pipe_id": pipe_id}


@router.post("/pipe/{pipe_id}/split")
async def split_pipe(
    pipe_id: str,
    req: SplitPipeRequest,
    state: SimulationState = Depends(get_simulation_state),
):
    """
    Insert a new junction at (req.lat, req.lon) and split pipe_id into two.
    Returns the new junction ID and the two replacement pipe IDs.
    """
    wn = state.wn
    if pipe_id not in wn.pipe_name_list:
        raise HTTPException(status_code=404, detail=f"Pipe {pipe_id!r} not found")

    link = wn.get_link(pipe_id)
    start_node_name = link.start_node_name
    end_node_name = link.end_node_name
    diameter = link.diameter       # metres
    roughness = link.roughness

    # Resolve endpoint lat/lon from topology (reliable lat/lon for all nodes)
    from app.network.topology import generate_network_data
    topo = generate_network_data()
    nodes_by_id: dict = {n["id"]: n for n in topo["nodes"]}
    res = topo["reservoir"]
    nodes_by_id[res["id"]] = res

    start = nodes_by_id.get(start_node_name)
    end = nodes_by_id.get(end_node_name)
    if not start or not end:
        raise HTTPException(status_code=500, detail="Cannot resolve endpoint coordinates")

    # Determine category from pipe diameter
    diameter_mm = diameter * 1000.0
    if diameter_mm >= 800:
        category = "trunk"
    elif diameter_mm >= 200:
        category = "distribution"
    else:
        category = "service"

    # Estimate elevation and zone for new junction
    from app.network.road_topology_builder import _assign_zone, _estimate_elevation
    zone = _assign_zone(req.lat, req.lon)
    elev = _estimate_elevation(req.lat, req.lon, zone)

    overrides = load_overrides()
    new_node_id = _next_node_id(overrides)

    # Create new junction in WNTR
    wn.add_junction(
        new_node_id,
        base_demand=0.0,
        demand_pattern="RES_PATTERN",
        elevation=elev,
    )
    wn.get_node(new_node_id).coordinates = (req.lon, req.lat)

    # Generate two pipe IDs without saving overrides yet
    prefix_map = {"service": "S", "distribution": "D", "trunk": "T"}
    tag = f"EDIT_{prefix_map.get(category, 'S')}"
    existing_nums = []
    for k in overrides["pipes"]:
        if k.startswith(tag):
            try:
                existing_nums.append(int(k.replace(tag, "")))
            except ValueError:
                pass
    base_num = (max(existing_nums) + 1) if existing_nums else 1
    pipe_a_id = f"{tag}{base_num:04d}"
    pipe_b_id = f"{tag}{base_num + 1:04d}"

    # Compute segment lengths
    len_a = max(_haversine_m(start["lat"], start["lon"], req.lat, req.lon), 1.0)
    len_b = max(_haversine_m(req.lat, req.lon, end["lat"], end["lon"]), 1.0)

    # Remove original pipe, add two replacements in WNTR
    wn.remove_link(pipe_id)
    wn.add_pipe(pipe_a_id, start_node_name, new_node_id,
                length=len_a, diameter=diameter, roughness=roughness,
                minor_loss=0.0, initial_status="Open")
    wn.add_pipe(pipe_b_id, new_node_id, end_node_name,
                length=len_b, diameter=diameter, roughness=roughness,
                minor_loss=0.0, initial_status="Open")

    # Persist to overrides
    overrides["nodes"][new_node_id] = {
        "id": new_node_id, "type": "junction",
        "lat": req.lat, "lon": req.lon,
        "elevation_m": elev, "base_demand_lps": 0.0,
        "zone": zone,
    }
    if pipe_id.startswith("EDIT_"):
        overrides["pipes"].pop(pipe_id, None)
    else:
        if pipe_id not in overrides["deleted_pipe_ids"]:
            overrides["deleted_pipe_ids"].append(pipe_id)

    for pid, sn, en, ln in [
        (pipe_a_id, start_node_name, new_node_id, len_a),
        (pipe_b_id, new_node_id, end_node_name, len_b),
    ]:
        overrides["pipes"][pid] = {
            "id": pid, "start_node": sn, "end_node": en,
            "length_m": round(ln, 1), "diameter_mm": round(diameter_mm, 1),
            "roughness_hw": roughness, "category": category,
            "road_name": "User-defined", "status": "open",
        }

    save_overrides(overrides)
    _invalidate_caches(state)

    return {
        "new_node_id": new_node_id,
        "pipe_a_id": pipe_a_id,
        "pipe_b_id": pipe_b_id,
        "lat": req.lat,
        "lon": req.lon,
    }

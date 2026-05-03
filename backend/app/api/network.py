from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_simulation_state
from app.simulation.state import SimulationState
from app.models.network import (
    NetworkTopologyResponse, NetworkStatusResponse,
    NodeModel, PipeModel, ReservoirModel, ZoneModel, ZoneBoundary,
    PipeOperationRequest, PipeOperationResponse,
)
from app.network.topology import generate_network_data
from app.network.zones import ZONE_DEFINITIONS, ZONE_BOUNDARIES

router = APIRouter(prefix="/network", tags=["network"])

# Cache network topology (it's static)
_topology_cache: NetworkTopologyResponse = None


def _build_topology() -> NetworkTopologyResponse:
    global _topology_cache
    if _topology_cache is not None:
        return _topology_cache

    data = generate_network_data()

    nodes = []
    for n in data["nodes"]:
        nodes.append(NodeModel(
            id=n["id"],
            type="junction",
            lat=n["lat"],
            lon=n["lon"],
            elevation_m=n["elevation_m"],
            base_demand_lps=n["base_demand_lps"],
            zone=n.get("zone"),
            depth_from_reservoir=n.get("depth_from_reservoir", -1),
            upstream_pipe_ids=n.get("upstream_pipe_ids", []),
            downstream_pipe_ids=n.get("downstream_pipe_ids", []),
        ))

    pipes = []
    for p in data["pipes"]:
        pipes.append(PipeModel(
            id=p["id"],
            start_node=p["start_node"],
            end_node=p["end_node"],
            length_m=p["length_m"],
            diameter_mm=p["diameter_mm"],
            roughness_hw=p["roughness_hw"],
            status=p.get("status", "open"),
            category=p["category"],
            upstream_node_id=p.get("upstream_node_id"),
            downstream_node_id=p.get("downstream_node_id"),
            road_name=p.get("road_name"),
        ))

    reservoir = ReservoirModel(
        id=data["reservoir"]["id"],
        lat=data["reservoir"]["lat"],
        lon=data["reservoir"]["lon"],
        head_m=data["reservoir"]["head_m"],
    )

    zones = []
    # Build node-to-zone mapping
    zone_nodes: dict = {}
    for n in data["nodes"]:
        z = n.get("zone")
        if z:
            zone_nodes.setdefault(z, []).append(n["id"])

    for zone_id, defn in ZONE_DEFINITIONS.items():
        boundary_coords = ZONE_BOUNDARIES.get(zone_id, [])
        zones.append(ZoneModel(
            id=zone_id,
            display_name=defn["display_name"],
            node_ids=zone_nodes.get(zone_id, []),
            boundary=ZoneBoundary(coordinates=boundary_coords),
        ))

    _topology_cache = NetworkTopologyResponse(
        nodes=nodes,
        pipes=pipes,
        reservoir=reservoir,
        zones=zones,
    )
    return _topology_cache


@router.get("/topology", response_model=NetworkTopologyResponse)
async def get_topology():
    """Return the complete network topology for map rendering."""
    return _build_topology()


@router.get("/status", response_model=NetworkStatusResponse)
async def get_status(state: SimulationState = Depends(get_simulation_state)):
    """Return current pipe open/closed state."""
    data = generate_network_data()
    total = len(data["pipes"])
    closed = list(state.closed_pipes)
    return NetworkStatusResponse(
        closed_pipes=closed,
        total_pipes=total,
        open_pipes=total - len(closed),
    )


@router.post("/reset")
async def reset_network(state: SimulationState = Depends(get_simulation_state)):
    """Reopen all closed pipes and clear simulation results."""
    await state.reset()
    return {"status": "reset", "message": "All pipes reopened and simulation results cleared."}

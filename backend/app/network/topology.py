"""
Bukit Batok Water Distribution Network — Topology Entry Point

Node and pipe geometry is derived from OpenStreetMap road data via
road_topology_builder.py. Junctions follow actual road alignments;
curved roads are approximated by multiple short straight pipe segments.
"""

from typing import Dict, List, Any

# ---------------------------------------------------------------------------
# Constants (imported by generator.py)
# ---------------------------------------------------------------------------

RESERVOIR_ID     = "R001"
RESERVOIR_LAT    = 1.354710
RESERVOIR_LON    = 103.748655
RESERVOIR_HEAD_M = 45.0

TOTAL_POPULATION      = 54_297
PER_CAPITA_DEMAND_LPD = 141
TOTAL_DEMAND_LPS      = (TOTAL_POPULATION * PER_CAPITA_DEMAND_LPD) / 86_400.0  # ≈ 88.6 L/s

DEMAND_PATTERN_24H: List[float] = [
    0.32, 0.32, 0.32, 0.32, 0.32, 0.32,   # 00–06  night
    1.30, 1.95, 1.95,                       # 06–09  morning peak
    1.08, 1.08, 1.08,                       # 09–12  midday
    1.30, 1.30,                             # 12–14  lunch
    0.86, 0.86, 0.86,                       # 14–17  afternoon
    1.73, 1.73, 1.73,                       # 17–20  evening peak
    1.08, 1.08,                             # 20–22  evening
    0.54, 0.54,                             # 22–24  ramp-down
]

GATE_VALVE_PIPE_IDS: set = set()

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

from app.network.road_topology_builder import build_road_network_data

_cache: Dict = None


def generate_network_data() -> Dict[str, Any]:
    global _cache
    if _cache is None:
        from app.network.overrides import load_overrides, apply_overrides_to_topology
        raw = build_road_network_data()
        _cache = apply_overrides_to_topology(raw, load_overrides())
    return _cache


def get_zone_for_node(node_id: str, nodes: list) -> str:
    for node in nodes:
        if node["id"] == node_id:
            return node.get("zone", "unknown")
    return "unknown"

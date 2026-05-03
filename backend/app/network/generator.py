"""
EPANET/WNTR Network Builder

Converts the raw topology data from topology.py into a WNTR WaterNetworkModel
that can be simulated and exported as an EPANET .inp file.
"""

import wntr
import wntr.network
from typing import Dict, Any

from app.network.topology import generate_network_data, DEMAND_PATTERN_24H


def _epanet_coords(lat: float, lon: float, lat_ref: float, lon_ref: float):
    """
    Convert WGS84 lat/lon to EPANET display coordinates in metres,
    centred on the reference point (the reservoir).
    """
    import math
    x_m = (lon - lon_ref) * math.cos(math.radians(lat_ref)) * 111_289.0
    y_m = (lat - lat_ref) * 110_540.0
    return round(x_m, 2), round(y_m, 2)


def build_network() -> wntr.network.WaterNetworkModel:
    """
    Build and return a fully configured WNTR WaterNetworkModel
    for the Bukit Batok water distribution system.
    """
    data = generate_network_data()
    reservoir = data["reservoir"]
    nodes = data["nodes"]
    pipes = data["pipes"]
    pattern = data["demand_pattern"]

    lat_ref = reservoir["lat"]
    lon_ref = reservoir["lon"]

    wn = wntr.network.WaterNetworkModel()

    # ------------------------------------------------------------------
    # Options
    # ------------------------------------------------------------------
    wn.options.hydraulic.headloss = "H-W"
    wn.options.hydraulic.demand_model = "DDA"   # Demand-Driven Analysis
    wn.options.time.duration = 24 * 3600        # 24-hour simulation
    wn.options.time.hydraulic_timestep = 3600   # 1-hour timestep
    wn.options.time.pattern_timestep = 3600

    # ------------------------------------------------------------------
    # Demand pattern
    # ------------------------------------------------------------------
    wn.add_pattern("RES_PATTERN", pattern)

    # ------------------------------------------------------------------
    # Reservoir
    # ------------------------------------------------------------------
    wn.add_reservoir(
        reservoir["id"],
        base_head=reservoir["head_m"],
    )
    x_r, y_r = _epanet_coords(reservoir["lat"], reservoir["lon"], lat_ref, lon_ref)
    wn.get_node(reservoir["id"]).coordinates = (x_r, y_r)

    # ------------------------------------------------------------------
    # Junctions
    # ------------------------------------------------------------------
    for node in nodes:
        # WNTR Python API expects flow in m³/s; topology stores L/s
        demand_m3s = node["base_demand_lps"] / 1000.0
        wn.add_junction(
            node["id"],
            base_demand=demand_m3s,
            demand_pattern="RES_PATTERN",
            elevation=node["elevation_m"],
        )
        x, y = _epanet_coords(node["lat"], node["lon"], lat_ref, lon_ref)
        wn.get_node(node["id"]).coordinates = (x, y)

    # ------------------------------------------------------------------
    # Pipes (includes trunk mains, distribution, service, gate valves)
    # ------------------------------------------------------------------
    for pipe in pipes:
        diameter_m = pipe["diameter_mm"] / 1000.0
        wn.add_pipe(
            pipe["id"],
            pipe["start_node"],
            pipe["end_node"],
            length=pipe["length_m"],
            diameter=diameter_m,
            roughness=pipe["roughness_hw"],
            minor_loss=0.0,
            initial_status="Open",
        )

    return wn

"""
Zone definitions for the Bukit Batok water distribution network.
Four zones: Central, West, East, and Gombak.
"""

from typing import Dict, Any, List


ZONE_DEFINITIONS: Dict[str, Any] = {
    "bukit_batok_central": {
        "display_name": "Bukit Batok Central",
        "lat_range": (1.343, 1.356),
        "lon_range": (103.747, 103.755),
        "elev_range": (24, 34),
        "pop_fraction": 0.25,
    },
    "bukit_batok_west": {
        "display_name": "Bukit Batok West",
        "lat_range": (1.343, 1.356),
        "lon_range": (103.736, 103.747),
        "elev_range": (22, 34),
        "pop_fraction": 0.25,
    },
    "bukit_batok_east": {
        "display_name": "Bukit Batok East",
        "lat_range": (1.337, 1.356),
        "lon_range": (103.753, 103.767),
        "elev_range": (15, 30),
        "pop_fraction": 0.25,
    },
    "bukit_gombak": {
        "display_name": "Bukit Gombak",
        "lat_range": (1.356, 1.372),
        "lon_range": (103.736, 103.755),
        "elev_range": (20, 34),
        "pop_fraction": 0.25,
    },
}

# Zone boundary polygons for map overlay (real geographic extents)
ZONE_BOUNDARIES: Dict[str, List[List[float]]] = {
    "bukit_batok_central": [
        [1.356, 103.747], [1.356, 103.755],
        [1.343, 103.755], [1.343, 103.747], [1.356, 103.747],
    ],
    "bukit_batok_west": [
        [1.356, 103.736], [1.356, 103.747],
        [1.343, 103.747], [1.343, 103.736], [1.356, 103.736],
    ],
    "bukit_batok_east": [
        [1.356, 103.753], [1.356, 103.767],
        [1.337, 103.767], [1.337, 103.753], [1.356, 103.753],
    ],
    "bukit_gombak": [
        [1.372, 103.736], [1.372, 103.755],
        [1.356, 103.755], [1.356, 103.736], [1.372, 103.736],
    ],
}


def get_zone_display_name(zone_id: str) -> str:
    defn = ZONE_DEFINITIONS.get(zone_id)
    if defn:
        return defn["display_name"]
    return zone_id

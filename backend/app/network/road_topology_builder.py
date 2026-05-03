"""
Road-following network topology builder for Bukit Batok water distribution system.

Reads overpass_data.json (OpenStreetMap road geometry) and generates junctions
at road intersections and intermediate points, with pipes along each road.
"""

import json
import math
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Tuple, Any, Optional

OVERPASS_DATA = Path(__file__).parents[3] / "overpass_data.json"

RESERVOIR_LAT = 1.354710
RESERVOIR_LON = 103.748655
TOTAL_DEMAND_LPS = (54_297 * 141) / 86_400.0  # ≈ 88.6 L/s

DEMAND_PATTERN_24H = [
    0.32, 0.32, 0.32, 0.32, 0.32, 0.32,
    1.30, 1.95, 1.95,
    1.08, 1.08, 1.08,
    1.30, 1.30,
    0.86, 0.86, 0.86,
    1.73, 1.73, 1.73,
    1.08, 1.08,
    0.54, 0.54,
]

# OSM highway tag → (category, diameter_mm, roughness_hw, intermediate_spacing_m | None)
ROAD_CONFIG: Dict[str, Tuple] = {
    "primary":        ("trunk",        1000, 120, 200),
    "primary_link":   ("trunk",        1000, 120, 200),
    "secondary":      ("distribution",  300, 120, 250),
    "secondary_link": ("distribution",  300, 120, 250),
    "tertiary":       ("distribution",  300, 120, None),
    "tertiary_link":  ("distribution",  300, 120, None),
    "residential":    ("service",       100, 130, None),
}

ZONE_DEFS = {
    "bukit_batok_central": {
        "lat_range": (1.343, 1.356), "lon_range": (103.747, 103.755), "elev_range": (24, 34),
    },
    "bukit_batok_west": {
        "lat_range": (1.343, 1.356), "lon_range": (103.736, 103.747), "elev_range": (22, 34),
    },
    "bukit_batok_east": {
        "lat_range": (1.337, 1.356), "lon_range": (103.753, 103.767), "elev_range": (15, 30),
    },
    "bukit_gombak": {
        "lat_range": (1.356, 1.372), "lon_range": (103.736, 103.755), "elev_range": (20, 34),
    },
}
DEFAULT_ZONE = "bukit_batok_central"


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371_000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    a = (math.sin((phi2 - phi1) / 2) ** 2
         + math.cos(phi1) * math.cos(phi2) * math.sin(math.radians((lon2 - lon1) / 2)) ** 2)
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _ways_parallel(coords1: List[Tuple[float, float]], coords2: List[Tuple[float, float]],
                   threshold: float = 40.0) -> bool:
    """
    Return True only if way1 and way2 run side-by-side (parallel carriageways).
    Uses the average of per-node minimum distances: for truly parallel ways the
    average is small (carriageway separation ~10-30 m).  Sequential ways that
    merely share an endpoint will have a large average because most of their
    nodes are far apart.
    """
    if not coords1 or not coords2:
        return False
    step1 = max(1, len(coords1) // 8)
    step2 = max(1, len(coords2) // 8)
    sampled1 = coords1[::step1]
    sampled2 = coords2[::step2]
    total = sum(
        min(_haversine_m(lat1, lon1, lat2, lon2) for lat2, lon2 in sampled2)
        for lat1, lon1 in sampled1
    )
    return (total / len(sampled1)) < threshold


def _deduplicate_parallel_ways(raw_ways: List[dict],
                                osm_coords: Dict[int, Tuple[float, float]]) -> List[dict]:
    """
    Remove duplicate parallel ways that represent the same physical road.
    Singapore divided roads often have two one-way OSM ways with identical names
    running side-by-side.  Within each same-name group, cluster ways by proximity
    (any node within 50 m) and keep only the way with the most nodes per cluster.
    Unnamed ways are kept as-is.
    """
    by_name: Dict[str, List[dict]] = defaultdict(list)
    unnamed: List[dict] = []

    for way in raw_ways:
        name = way.get("tags", {}).get("name", "").strip()
        if name:
            by_name[name].append(way)
        else:
            unnamed.append(way)

    result: List[dict] = list(unnamed)

    for name, group in by_name.items():
        if len(group) == 1:
            result.extend(group)
            continue

        # Build node-coordinate lists for each way
        way_coords: List[List[Tuple[float, float]]] = [
            [osm_coords[n] for n in way["nodes"] if n in osm_coords]
            for way in group
        ]

        # Union-Find to cluster geographically close ways
        parent = list(range(len(group)))

        def _find(x: int) -> int:
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                if way_coords[i] and way_coords[j] and _ways_parallel(way_coords[i], way_coords[j]):
                    pi, pj = _find(i), _find(j)
                    if pi != pj:
                        parent[pi] = pj

        # Group indices by cluster root
        clusters: Dict[int, List[int]] = defaultdict(list)
        for i in range(len(group)):
            clusters[_find(i)].append(i)

        # From each cluster keep the way with the most nodes
        for indices in clusters.values():
            best = max(indices, key=lambda i: len(group[i]["nodes"]))
            result.append(group[best])

    return result


def _assign_zone(lat: float, lon: float) -> str:
    for zone_id, d in ZONE_DEFS.items():
        lat_lo, lat_hi = d["lat_range"]
        lon_lo, lon_hi = d["lon_range"]
        if lat_lo <= lat <= lat_hi and lon_lo <= lon <= lon_hi:
            return zone_id
    return DEFAULT_ZONE


def _estimate_elevation(lat: float, lon: float, zone_id: str) -> float:
    d = ZONE_DEFS[zone_id]
    lo, hi = d["elev_range"]
    lat_lo, lat_hi = d["lat_range"]
    lon_lo, lon_hi = d["lon_range"]
    fl = (lat - lat_lo) / (lat_hi - lat_lo) if lat_hi != lat_lo else 0.5
    fn = (lon - lon_lo) / (lon_hi - lon_lo) if lon_hi != lon_lo else 0.5
    fl = max(0.0, min(1.0, fl))
    fn = max(0.0, min(1.0, fn))
    return round(lo + (hi - lo) * (0.6 * fl + 0.4 * fn), 1)


def build_road_network_data() -> Dict[str, Any]:
    # -----------------------------------------------------------------------
    # 1. Load OSM data
    # -----------------------------------------------------------------------
    with open(OVERPASS_DATA, encoding="utf-8") as f:
        data = json.load(f)

    osm_coords: Dict[int, Tuple[float, float]] = {}
    raw_ways: List[dict] = []

    for elem in data["elements"]:
        t = elem.get("type")
        if t == "node":
            osm_coords[elem["id"]] = (elem["lat"], elem["lon"])
        elif t == "way":
            hw = elem.get("tags", {}).get("highway", "")
            if hw in ROAD_CONFIG:
                raw_ways.append(elem)

    # -----------------------------------------------------------------------
    # 2. Count way-membership per OSM node (intersection detection)
    # -----------------------------------------------------------------------
    node_way_count: Dict[int, int] = defaultdict(int)
    for way in raw_ways:
        for nid in way["nodes"]:
            node_way_count[nid] += 1

    # -----------------------------------------------------------------------
    # 3. Junction registry with grid-snapping (~30 m)
    #
    # Singapore divided roads have two parallel OSM ways whose intersection
    # nodes sit ~15-25 m apart.  Snapping all nodes to a 0.00030° grid
    # (~33 m) merges those near-duplicate nodes into one junction.  The
    # existing seen_pairs dedup then naturally drops the second parallel pipe.
    # -----------------------------------------------------------------------
    SNAP_GRID_DEG = 0.00030  # ≈ 33 m per cell at Singapore latitude

    grid_to_jid: Dict[Tuple[int, int], str] = {}
    synth_to_jid: Dict[Tuple[float, float], str] = {}
    jid_coords: Dict[str, Tuple[float, float]] = {}
    _counter = [1]

    def _next_jid() -> str:
        jid = f"J{_counter[0]:04d}"
        _counter[0] += 1
        return jid

    def _get_osm_jid(osm_id: int) -> Optional[str]:
        if osm_id not in osm_coords:
            return None
        lat, lon = osm_coords[osm_id]
        gk = (round(lat / SNAP_GRID_DEG), round(lon / SNAP_GRID_DEG))
        if gk not in grid_to_jid:
            jid = _next_jid()
            grid_to_jid[gk] = jid
            jid_coords[jid] = (lat, lon)
        return grid_to_jid[gk]

    def _get_synth_jid(lat: float, lon: float) -> str:
        key = (round(lat, 6), round(lon, 6))
        if key not in synth_to_jid:
            jid = _next_jid()
            synth_to_jid[key] = jid
            jid_coords[jid] = (lat, lon)
        return synth_to_jid[key]

    # -----------------------------------------------------------------------
    # 4. Process ways → raw pipe segments
    # -----------------------------------------------------------------------
    raw_segments: List[Tuple[str, str, float, str, int, int, str]] = []
    seen_pairs: set = set()

    for way in raw_ways:
        hw = way.get("tags", {}).get("highway", "")
        category, diam, rough, spacing = ROAD_CONFIG[hw]
        road_name = way.get("tags", {}).get("name", "Unnamed Road")

        # Resolve OSM node IDs to coordinates (drop missing)
        valid_nodes = [nid for nid in way["nodes"] if nid in osm_coords]
        if len(valid_nodes) < 2:
            continue

        # Mandatory nodes: endpoints and intersections (in ≥ 2 ways)
        mandatory: List[Tuple[str, float, float]] = []
        for i, nid in enumerate(valid_nodes):
            if i == 0 or i == len(valid_nodes) - 1 or node_way_count[nid] >= 2:
                jid = _get_osm_jid(nid)
                if jid:
                    lat, lon = osm_coords[nid]
                    mandatory.append((jid, lat, lon))

        if len(mandatory) < 2:
            continue

        # Build full sequence: mandatory nodes + synthetic intermediates
        full_seq: List[Tuple[str, float, float]] = []
        for i in range(len(mandatory) - 1):
            jid1, lat1, lon1 = mandatory[i]
            jid2, lat2, lon2 = mandatory[i + 1]
            full_seq.append((jid1, lat1, lon1))

            if spacing is not None:
                dist = _haversine_m(lat1, lon1, lat2, lon2)
                if dist > spacing:
                    n = int(dist / spacing)
                    for k in range(1, n + 1):
                        frac = k / (n + 1)
                        ilat = lat1 + (lat2 - lat1) * frac
                        ilon = lon1 + (lon2 - lon1) * frac
                        full_seq.append((_get_synth_jid(ilat, ilon), ilat, ilon))

        full_seq.append(mandatory[-1])

        # Emit pipe segments
        for i in range(len(full_seq) - 1):
            ja, lat_a, lon_a = full_seq[i]
            jb, lat_b, lon_b = full_seq[i + 1]
            if ja == jb:
                continue
            pair = frozenset({ja, jb})
            if pair in seen_pairs:
                continue
            seen_pairs.add(pair)
            length = _haversine_m(lat_a, lon_a, lat_b, lon_b)
            if length < 5.0:
                continue
            raw_segments.append((ja, jb, length, category, diam, rough, road_name))

    # -----------------------------------------------------------------------
    # 5. Connect reservoir to nearest junction
    # -----------------------------------------------------------------------
    nearest_jid = min(
        jid_coords,
        key=lambda j: _haversine_m(RESERVOIR_LAT, RESERVOIR_LON,
                                    jid_coords[j][0], jid_coords[j][1]),
    )
    res_lat, res_lon = jid_coords[nearest_jid]
    res_dist = _haversine_m(RESERVOIR_LAT, RESERVOIR_LON, res_lat, res_lon)
    raw_segments.append(("R001", nearest_jid, res_dist, "trunk", 1000, 120, "Reservoir Connection"))

    # -----------------------------------------------------------------------
    # 6. BFS to keep only the connected component reachable from R001
    # -----------------------------------------------------------------------
    adj: Dict[str, List[str]] = defaultdict(list)
    for ja, jb, _len, _cat, _dia, _ro, _rn in raw_segments:
        adj[ja].append(jb)
        adj[jb].append(ja)

    visited: set = {"R001"}
    stack = ["R001"]
    while stack:
        node = stack.pop()
        for nb in adj[node]:
            if nb not in visited:
                visited.add(nb)
                stack.append(nb)

    connected_jids = {j for j in visited if j != "R001"}
    final_segments = [s for s in raw_segments if s[0] in visited and s[1] in visited]

    # -----------------------------------------------------------------------
    # 7. Assign zone, elevation, demand (equal distribution across all nodes)
    # -----------------------------------------------------------------------
    demand_per_node = round(TOTAL_DEMAND_LPS / max(len(connected_jids), 1), 6)

    nodes = []
    for jid in sorted(connected_jids):
        lat, lon = jid_coords[jid]
        zone = _assign_zone(lat, lon)
        elev = _estimate_elevation(lat, lon, zone)
        nodes.append({
            "id": jid,
            "type": "junction",
            "lat": round(lat, 7),
            "lon": round(lon, 7),
            "elevation_m": elev,
            "base_demand_lps": demand_per_node,
            "zone": zone,
        })

    # -----------------------------------------------------------------------
    # 8. Assign sequential pipe IDs by category
    # -----------------------------------------------------------------------
    trunk_n = dist_n = svc_n = 0
    pipes = []
    for ja, jb, length, category, diam, rough, road_name in final_segments:
        if category == "trunk":
            trunk_n += 1
            pid = f"T{trunk_n:04d}"
        elif category == "distribution":
            dist_n += 1
            pid = f"D{dist_n:04d}"
        else:
            svc_n += 1
            pid = f"S{svc_n:04d}"

        pipes.append({
            "id": pid,
            "start_node": ja,
            "end_node": jb,
            "length_m": round(length, 1),
            "diameter_mm": diam,
            "roughness_hw": rough,
            "category": category,
            "road_name": road_name,
            "status": "open",
        })

    # -----------------------------------------------------------------------
    # 9. BFS depth from reservoir + upstream/downstream connectivity
    # -----------------------------------------------------------------------
    from collections import deque

    # Build adjacency: node → list of (neighbour, pipe_id)
    pipe_adj: Dict[str, List[Tuple[str, str]]] = defaultdict(list)
    for p in pipes:
        pipe_adj[p["start_node"]].append((p["end_node"], p["id"]))
        pipe_adj[p["end_node"]].append((p["start_node"], p["id"]))

    # BFS to assign hop-depth from R001
    depth: Dict[str, int] = {"R001": 0}
    queue: deque = deque(["R001"])
    while queue:
        node = queue.popleft()
        for nb, _ in pipe_adj[node]:
            if nb not in depth:
                depth[nb] = depth[node] + 1
                queue.append(nb)

    # Tag each pipe with upstream/downstream node IDs (by BFS depth)
    for p in pipes:
        da = depth.get(p["start_node"], 9999)
        db = depth.get(p["end_node"], 9999)
        if da <= db:
            p["upstream_node_id"]   = p["start_node"]
            p["downstream_node_id"] = p["end_node"]
        else:
            p["upstream_node_id"]   = p["end_node"]
            p["downstream_node_id"] = p["start_node"]

    # Build per-node upstream/downstream pipe lists
    upstream_pipes:   Dict[str, List[str]] = defaultdict(list)  # pipes that FEED this node
    downstream_pipes: Dict[str, List[str]] = defaultdict(list)  # pipes this node FEEDS

    for p in pipes:
        downstream_pipes[p["upstream_node_id"]].append(p["id"])
        upstream_pipes[p["downstream_node_id"]].append(p["id"])

    # Tag each node
    for n in nodes:
        nid = n["id"]
        n["depth_from_reservoir"]  = depth.get(nid, -1)
        n["upstream_pipe_ids"]     = upstream_pipes.get(nid, [])
        n["downstream_pipe_ids"]   = downstream_pipes.get(nid, [])

    return {
        "reservoir": {"id": "R001", "lat": RESERVOIR_LAT, "lon": RESERVOIR_LON, "head_m": 45.0},
        "nodes": nodes,
        "pipes": pipes,
        "demand_pattern": DEMAND_PATTERN_24H,
    }

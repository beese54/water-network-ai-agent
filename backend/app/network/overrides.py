"""
Network edit persistence — loads/saves network_overrides.json.

The overrides file stores a full description of user edits on top of the
OSM-derived base network.  apply_overrides_to_topology() merges them into
the raw topology dict before BFS/zone/demand metadata is computed.
"""

import json
import os
from pathlib import Path
from typing import Dict, Any

OVERRIDES_PATH = Path(__file__).parents[3] / "data" / "network_overrides.json"


def _empty() -> Dict[str, Any]:
    return {
        "nodes": {},           # EDIT_J#### → node dict
        "pipes": {},           # EDIT_S/D/T#### → pipe dict
        "deleted_node_ids": [],
        "deleted_pipe_ids": [],
        "moved_nodes": {},     # existing node_id → {lat, lon, elevation_m}
    }


def load_overrides() -> Dict[str, Any]:
    if not OVERRIDES_PATH.exists():
        return _empty()
    try:
        with open(OVERRIDES_PATH, encoding="utf-8") as f:
            data = json.load(f)
        # Ensure all keys present (backwards-compat if file was written by older code)
        base = _empty()
        base.update(data)
        return base
    except Exception:
        return _empty()


def save_overrides(overrides: Dict[str, Any]) -> None:
    """Atomic write: write to .tmp then rename."""
    tmp = OVERRIDES_PATH.with_suffix(".tmp")
    OVERRIDES_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(overrides, f, indent=2)
    os.replace(tmp, OVERRIDES_PATH)


def apply_overrides_to_topology(raw: Dict[str, Any], overrides: Dict[str, Any]) -> Dict[str, Any]:
    """
    Merge user edits into the raw topology dict returned by build_road_network_data().

    raw has keys "nodes" (list of dicts) and "pipes" (list of dicts).
    Returns a new dict with the same structure after applying:
      1. Remove deleted nodes (and any pipes touching them)
      2. Remove deleted pipes
      3. Patch coordinates/elevation for moved nodes
      4. Append EDIT_* added nodes
      5. Append EDIT_* added pipes
    """
    deleted_nodes = set(overrides.get("deleted_node_ids", []))
    deleted_pipes = set(overrides.get("deleted_pipe_ids", []))
    moved_nodes = overrides.get("moved_nodes", {})

    # Filter nodes
    nodes = [
        n for n in raw.get("nodes", [])
        if n["id"] not in deleted_nodes
    ]

    # Filter pipes — drop deleted pipes and pipes whose endpoints were deleted
    pipes = [
        p for p in raw.get("pipes", [])
        if p["id"] not in deleted_pipes
        and p["start_node"] not in deleted_nodes
        and p["end_node"] not in deleted_nodes
    ]

    # Patch moved nodes
    for node in nodes:
        if node["id"] in moved_nodes:
            patch = moved_nodes[node["id"]]
            node = dict(node)  # shallow copy so we don't mutate cached data
            node["lat"] = patch["lat"]
            node["lon"] = patch["lon"]
            node["elevation_m"] = patch.get("elevation_m", node["elevation_m"])
        # re-assign in the list by rebuilding (nodes is already a new list from the comprehension)

    # Rebuild with patched moved nodes properly
    patched_nodes = []
    for node in raw.get("nodes", []):
        if node["id"] in deleted_nodes:
            continue
        if node["id"] in moved_nodes:
            node = dict(node)
            patch = moved_nodes[node["id"]]
            node["lat"] = patch["lat"]
            node["lon"] = patch["lon"]
            node["elevation_m"] = patch.get("elevation_m", node["elevation_m"])
        patched_nodes.append(node)

    # Append EDIT_* nodes
    for edit_node in overrides.get("nodes", {}).values():
        patched_nodes.append(edit_node)

    # Append EDIT_* pipes
    patched_pipes = [
        p for p in pipes
    ]
    for edit_pipe in overrides.get("pipes", {}).values():
        patched_pipes.append(edit_pipe)

    return {
        **{k: v for k, v in raw.items() if k not in ("nodes", "pipes")},
        "nodes": patched_nodes,
        "pipes": patched_pipes,
    }

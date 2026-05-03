from pydantic import BaseModel
from typing import List, Optional
from enum import Enum


class NodeType(str, Enum):
    junction = "junction"
    reservoir = "reservoir"


class PipeStatus(str, Enum):
    open = "open"
    closed = "closed"


class PipeCategory(str, Enum):
    trunk = "trunk"
    distribution = "distribution"
    service = "service"
    valve = "valve"


class NodeModel(BaseModel):
    id: str
    type: NodeType
    lat: float
    lon: float
    elevation_m: float
    base_demand_lps: float = 0.0
    zone: Optional[str] = None
    depth_from_reservoir: int = -1
    upstream_pipe_ids: List[str] = []
    downstream_pipe_ids: List[str] = []


class ReservoirModel(BaseModel):
    id: str
    lat: float
    lon: float
    head_m: float


class PipeModel(BaseModel):
    id: str
    start_node: str
    end_node: str
    length_m: float
    diameter_mm: float
    roughness_hw: float
    status: PipeStatus = PipeStatus.open
    category: PipeCategory = PipeCategory.service
    upstream_node_id: Optional[str] = None
    downstream_node_id: Optional[str] = None
    road_name: Optional[str] = None


class ZoneBoundary(BaseModel):
    """Approximate polygon boundary for map overlay (list of [lat, lon] pairs)."""
    coordinates: List[List[float]]


class ZoneModel(BaseModel):
    id: str
    display_name: str
    node_ids: List[str]
    boundary: ZoneBoundary


class NetworkTopologyResponse(BaseModel):
    nodes: List[NodeModel]
    pipes: List[PipeModel]
    reservoir: ReservoirModel
    zones: List[ZoneModel]


class NetworkStatusResponse(BaseModel):
    closed_pipes: List[str]
    total_pipes: int
    open_pipes: int


class PipeOperationRequest(BaseModel):
    pipe_ids: List[str]


class PipeOperationResponse(BaseModel):
    success: List[str]
    not_found: List[str]
    already_in_state: List[str]

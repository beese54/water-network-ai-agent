from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class NodeResult(BaseModel):
    node_id: str
    pressure_bar: float
    head_m: float
    demand_lps: float
    lat: float
    lon: float
    elevation_m: float
    zone: Optional[str] = None
    below_threshold: bool = False


class PipeResult(BaseModel):
    pipe_id: str
    flow_lps: float
    velocity_mps: float
    status: str


class SimulationSummary(BaseModel):
    min_pressure_bar: float
    max_pressure_bar: float
    avg_pressure_bar: float
    nodes_below_threshold: int
    threshold_bar: float
    total_nodes: int


class SimulationResult(BaseModel):
    status: str
    simulation_id: str
    duration_ms: int
    node_results: List[NodeResult]
    pipe_results: List[PipeResult]
    summary: SimulationSummary
    timestamp: str


class ShutdownAnalysisRequest(BaseModel):
    pipe_ids: List[str]
    start_datetime: str
    end_datetime: str


class HourlyPressureSummary(BaseModel):
    hour: int
    demand_multiplier: float
    avg_pressure_bar: float
    min_pressure_bar: float
    max_pressure_bar: float
    nodes_below_threshold: int


class HourlyFlowSummary(BaseModel):
    hour: int
    pipe_id: str
    flow_lps: float
    velocity_mps: float


class NodeImpact(BaseModel):
    node_id: str
    lat: float
    lon: float
    elevation_m: float
    zone: Optional[str] = None
    side: str  # "upstream" | "downstream"
    depth_from_reservoir: int = -1
    upstream_pipe_ids: List[str] = []
    downstream_pipe_ids: List[str] = []
    baseline_pressure_bar: float
    shutdown_pressure_bar: float
    pressure_delta_bar: float


class PipeImpact(BaseModel):
    pipe_id: str
    start_node: str
    end_node: str
    category: str
    side: str  # "shutdown" | "upstream" | "downstream"
    baseline_flow_lps: float
    shutdown_flow_lps: float
    flow_delta_lps: float
    baseline_velocity_mps: float
    shutdown_velocity_mps: float
    velocity_delta_mps: float


class ShutdownAnalysisResult(BaseModel):
    analysis_id: str
    pipe_ids: List[str]
    start_datetime: str
    end_datetime: str
    duration_ms: int
    baseline_pressure: List[HourlyPressureSummary]
    shutdown_pressure: List[HourlyPressureSummary]
    baseline_flow: List[HourlyFlowSummary]
    shutdown_flow: List[HourlyFlowSummary]
    affected_node_ids: List[str]
    affected_bbox: List[float]
    summary_text: str
    node_impacts: List[NodeImpact] = []
    pipe_impacts: List[PipeImpact] = []


class AffectedNode(BaseModel):
    node_id: str
    pressure_bar: float
    head_m: float
    lat: float
    lon: float
    elevation_m: float
    zone: Optional[str] = None
    zone_display: Optional[str] = None

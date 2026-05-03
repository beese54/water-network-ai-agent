export interface NodeResult {
  node_id: string;
  pressure_bar: number;
  head_m: number;
  demand_lps: number;
  lat: number;
  lon: number;
  elevation_m: number;
  zone?: string;
  below_threshold: boolean;
}

export interface PipeResult {
  pipe_id: string;
  flow_lps: number;
  velocity_mps: number;
  status: string;
}

export interface SimulationSummary {
  min_pressure_bar: number;
  max_pressure_bar: number;
  avg_pressure_bar: number;
  nodes_below_threshold: number;
  threshold_bar: number;
  total_nodes: number;
}

export interface SimulationResult {
  status: string;
  simulation_id: string;
  duration_ms: number;
  node_results: NodeResult[];
  pipe_results: PipeResult[];
  summary: SimulationSummary;
  timestamp: string;
}

export interface AffectedNode {
  node_id: string;
  pressure_bar: number;
  head_m: number;
  lat: number;
  lon: number;
  elevation_m: number;
  zone?: string;
  zone_display?: string;
}

export interface ToolCallRecord {
  tool: string;
  input: Record<string, unknown>;
  output: unknown;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: ToolCallRecord[];
  affected_nodes?: AffectedNode[];
  timestamp: string;
}

export interface HourlyPressureSummary {
  hour: number;
  demand_multiplier: number;
  avg_pressure_bar: number;
  min_pressure_bar: number;
  max_pressure_bar: number;
  nodes_below_threshold: number;
}

export interface HourlyFlowSummary {
  hour: number;
  pipe_id: string;
  flow_lps: number;
  velocity_mps: number;
}

export interface NodeImpact {
  node_id: string;
  lat: number;
  lon: number;
  elevation_m: number;
  zone?: string;
  side: string;
  depth_from_reservoir: number;
  upstream_pipe_ids: string[];
  downstream_pipe_ids: string[];
  baseline_pressure_bar: number;
  shutdown_pressure_bar: number;
  pressure_delta_bar: number;
}

export interface PipeImpact {
  pipe_id: string;
  start_node: string;
  end_node: string;
  category: string;
  side: string;
  baseline_flow_lps: number;
  shutdown_flow_lps: number;
  flow_delta_lps: number;
  baseline_velocity_mps: number;
  shutdown_velocity_mps: number;
  velocity_delta_mps: number;
}

export interface ShutdownAnalysisResult {
  analysis_id: string;
  pipe_ids: string[];
  start_datetime: string;
  end_datetime: string;
  duration_ms: number;
  baseline_pressure: HourlyPressureSummary[];
  shutdown_pressure: HourlyPressureSummary[];
  baseline_flow: HourlyFlowSummary[];
  shutdown_flow: HourlyFlowSummary[];
  affected_node_ids: string[];
  affected_bbox: [number, number, number, number];
  summary_text: string;
  node_impacts: NodeImpact[];
  pipe_impacts: PipeImpact[];
}

export interface ShutdownAnalysisRequest {
  pipe_ids: string[];
  start_datetime: string;
  end_datetime: string;
}

export interface ChatResponse {
  session_id: string;
  reply: string;
  tool_calls: ToolCallRecord[];
  affected_nodes: AffectedNode[];
  network_state_changed: boolean;
}

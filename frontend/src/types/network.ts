export type NodeType = 'junction' | 'reservoir';
export type PipeStatus = 'open' | 'closed';
export type PipeCategory = 'trunk' | 'distribution' | 'service' | 'valve';

export interface NetworkNode {
  id: string;
  type: NodeType;
  lat: number;
  lon: number;
  elevation_m: number;
  base_demand_lps: number;
  zone?: string;
  depth_from_reservoir: number;
  upstream_pipe_ids: string[];
  downstream_pipe_ids: string[];
}

export interface NetworkReservoir {
  id: string;
  lat: number;
  lon: number;
  head_m: number;
}

export interface NetworkPipe {
  id: string;
  start_node: string;
  end_node: string;
  length_m: number;
  diameter_mm: number;
  roughness_hw: number;
  status: PipeStatus;
  category: PipeCategory;
  upstream_node_id?: string;
  downstream_node_id?: string;
  road_name?: string;
}

export interface ZoneBoundary {
  coordinates: [number, number][];
}

export interface NetworkZone {
  id: string;
  display_name: string;
  node_ids: string[];
  boundary: ZoneBoundary;
}

export interface NetworkTopology {
  nodes: NetworkNode[];
  pipes: NetworkPipe[];
  reservoir: NetworkReservoir;
  zones: NetworkZone[];
}

export interface NetworkStatus {
  closed_pipes: string[];
  total_pipes: number;
  open_pipes: number;
}

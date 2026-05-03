import api from './api';
import type { NetworkNode, NetworkPipe } from '../types/network';

export const addNode = (
  lat: number,
  lon: number,
  elevation_m = 0.0,
  base_demand_lps = 0.05,
): Promise<NetworkNode> =>
  api.post('/network/edit/node', { lat, lon, elevation_m, base_demand_lps }).then((r) => r.data);

export const deleteNode = (
  nodeId: string,
): Promise<{ deleted_node_id: string; deleted_pipe_ids: string[] }> =>
  api.delete(`/network/edit/node/${nodeId}`).then((r) => r.data);

export const moveNode = (
  nodeId: string,
  lat: number,
  lon: number,
  elevation_m: number,
): Promise<{ node_id: string; affected_pipe_ids: string[]; updated_lengths: Record<string, number> }> =>
  api.patch(`/network/edit/node/${nodeId}/move`, { lat, lon, elevation_m }).then((r) => r.data);

export const addPipe = (
  start_node_id: string,
  end_node_id: string,
  diameter_mm: number,
  category: string,
): Promise<NetworkPipe> =>
  api.post('/network/edit/pipe', { start_node_id, end_node_id, diameter_mm, category }).then((r) => r.data);

export const deletePipe = (
  pipeId: string,
): Promise<{ deleted_pipe_id: string }> =>
  api.delete(`/network/edit/pipe/${pipeId}`).then((r) => r.data);

export const setPipeStatus = (
  pipeId: string,
  status: 'open' | 'closed',
): Promise<void> => {
  const endpoint = status === 'closed' ? '/simulation/pipes/close' : '/simulation/pipes/open';
  return api.post(endpoint, { pipe_ids: [pipeId] }).then(() => undefined);
};

export const splitPipe = (
  pipeId: string,
  lat: number,
  lon: number,
): Promise<{ new_node_id: string; pipe_a_id: string; pipe_b_id: string; lat: number; lon: number }> =>
  api.post(`/network/edit/pipe/${pipeId}/split`, { lat, lon }).then((r) => r.data);

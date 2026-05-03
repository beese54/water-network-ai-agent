import api from './api';
import type { NetworkTopology, NetworkStatus } from '../types/network';

export const networkService = {
  getTopology: () => api.get<NetworkTopology>('/network/topology').then(r => r.data),
  getStatus: () => api.get<NetworkStatus>('/network/status').then(r => r.data),
  reset: () => api.post('/network/reset').then(r => r.data),
};

import api from './api';
import type { SimulationResult, ShutdownAnalysisResult, ShutdownAnalysisRequest } from '../types/simulation';

export const simulationService = {
  run: () => api.post<SimulationResult>('/simulation/run').then(r => r.data),
  getResults: () => api.get<SimulationResult>('/simulation/results').then(r => r.data),
  closePipes: (pipe_ids: string[]) =>
    api.post('/simulation/pipes/close', { pipe_ids }).then(r => r.data),
  openPipes: (pipe_ids: string[]) =>
    api.post('/simulation/pipes/open', { pipe_ids }).then(r => r.data),
  runShutdownAnalysis: (body: ShutdownAnalysisRequest) =>
    api.post<ShutdownAnalysisResult>('/simulation/shutdown-analysis', body).then(r => r.data),
};

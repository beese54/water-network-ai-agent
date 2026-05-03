import { create } from 'zustand';
import type { SimulationResult, AffectedNode } from '../types/simulation';
import { simulationService } from '../services/simulationService';

interface SimulationStore {
  result: SimulationResult | null;
  affectedNodes: AffectedNode[];
  isRunning: boolean;
  error: string | null;
  focusedNodeId: string | null;
  runSimulation: () => Promise<void>;
  fetchResults: () => Promise<void>;
  setAffectedNodes: (nodes: AffectedNode[]) => void;
  clearResults: () => void;
  setFocusedNode: (id: string | null) => void;
}

export const useSimulationStore = create<SimulationStore>((set) => ({
  result: null,
  affectedNodes: [],
  isRunning: false,
  error: null,
  focusedNodeId: null,

  runSimulation: async () => {
    set({ isRunning: true, error: null });
    try {
      const result = await simulationService.run();
      set({ result, isRunning: false });
    } catch (e: any) {
      set({ error: e.message, isRunning: false });
    }
  },

  fetchResults: async () => {
    try {
      const result = await simulationService.getResults();
      set({ result });
    } catch {
      // No results yet — ignore
    }
  },

  setAffectedNodes: (nodes: AffectedNode[]) => set({ affectedNodes: nodes }),

  clearResults: () => set({ result: null, affectedNodes: [], focusedNodeId: null }),

  setFocusedNode: (id: string | null) => set({ focusedNodeId: id }),
}));

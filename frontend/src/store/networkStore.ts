import { create } from 'zustand';
import type { NetworkTopology } from '../types/network';
import { networkService } from '../services/networkService';

interface NetworkStore {
  topology: NetworkTopology | null;
  closedPipes: Set<string>;
  isLoading: boolean;
  error: string | null;
  fetchTopology: () => Promise<void>;
  setClosedPipes: (closed: string[]) => void;
  markPipeClosed: (pipeId: string) => void;
  updatePipeStatus: (pipeId: string, status: 'open' | 'closed') => void;
  reset: () => Promise<void>;
}

export const useNetworkStore = create<NetworkStore>((set, get) => ({
  topology: null,
  closedPipes: new Set(),
  isLoading: false,
  error: null,

  fetchTopology: async () => {
    set({ isLoading: true, error: null });
    try {
      const topology = await networkService.getTopology();
      set({ topology, isLoading: false });
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
    }
  },

  setClosedPipes: (closed: string[]) => set({ closedPipes: new Set(closed) }),

  markPipeClosed: (pipeId: string) => {
    const s = new Set(get().closedPipes);
    s.add(pipeId);
    set({ closedPipes: s });
  },

  updatePipeStatus: (pipeId: string, status: 'open' | 'closed') => {
    const closed = new Set(get().closedPipes);
    if (status === 'closed') closed.add(pipeId); else closed.delete(pipeId);
    const topology = get().topology;
    const pipes = topology
      ? topology.pipes.map(p => p.id === pipeId ? { ...p, status } : p)
      : null;
    set({ closedPipes: closed, topology: topology ? { ...topology, pipes } : null });
  },

  reset: async () => {
    await networkService.reset();
    set({ closedPipes: new Set() });
  },
}));

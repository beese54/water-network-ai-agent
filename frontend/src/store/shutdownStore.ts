import { create } from 'zustand';
import type { ShutdownAnalysisResult, ShutdownAnalysisRequest } from '../types/simulation';
import { simulationService } from '../services/simulationService';

export type DashboardTab = 'planner' | 'pressure' | 'flow' | 'impact';

interface ShutdownForm {
  pipeIds: string;
  startDatetime: string;
  endDatetime: string;
}

interface ShutdownStore {
  isDashboardOpen: boolean;
  activeTab: DashboardTab;
  form: ShutdownForm;
  isAnalysing: boolean;
  analysisResult: ShutdownAnalysisResult | null;
  analysisError: string | null;
  selectionMode: boolean;
  selectedPipeIds: string[];

  toggleDashboard: () => void;
  openDashboard: () => void;
  setActiveTab: (tab: DashboardTab) => void;
  updateForm: (patch: Partial<ShutdownForm>) => void;
  runAnalysis: () => Promise<void>;
  clearAnalysis: () => void;
  toggleSelectionMode: () => void;
  togglePipeSelection: (id: string) => void;
  clearPipeSelection: () => void;
}

const DEFAULT_FORM: ShutdownForm = { pipeIds: '', startDatetime: '', endDatetime: '' };

export const useShutdownStore = create<ShutdownStore>((set, get) => ({
  isDashboardOpen: false,
  activeTab: 'planner',
  form: { ...DEFAULT_FORM },
  isAnalysing: false,
  analysisResult: null,
  analysisError: null,
  selectionMode: false,
  selectedPipeIds: [],

  toggleDashboard: () => set(s => ({ isDashboardOpen: !s.isDashboardOpen })),
  openDashboard: () => set({ isDashboardOpen: true }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  updateForm: (patch) => set(s => ({ form: { ...s.form, ...patch } })),

  toggleSelectionMode: () => set(s => ({ selectionMode: !s.selectionMode })),

  togglePipeSelection: (id) => {
    const { selectedPipeIds, form } = get();
    const updated = selectedPipeIds.includes(id)
      ? selectedPipeIds.filter(p => p !== id)
      : [...selectedPipeIds, id];
    set({ selectedPipeIds: updated, form: { ...form, pipeIds: updated.join(', ') } });
  },

  clearPipeSelection: () => set(s => ({ selectedPipeIds: [], form: { ...s.form, pipeIds: '' } })),

  runAnalysis: async () => {
    const { form } = get();
    const pipeIds = form.pipeIds.split(',').map(s => s.trim()).filter(Boolean);
    if (!pipeIds.length || !form.startDatetime || !form.endDatetime) {
      set({ analysisError: 'Please fill in all fields: pipe IDs, start time, and end time.' });
      return;
    }
    set({ isAnalysing: true, analysisError: null });
    try {
      const body: ShutdownAnalysisRequest = {
        pipe_ids: pipeIds,
        start_datetime: form.startDatetime,
        end_datetime: form.endDatetime,
      };
      const result = await simulationService.runShutdownAnalysis(body);
      set({ analysisResult: result, isAnalysing: false, activeTab: 'impact', isDashboardOpen: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Analysis failed.';
      set({ analysisError: msg, isAnalysing: false });
    }
  },

  clearAnalysis: () => set({
    analysisResult: null, analysisError: null,
    form: { ...DEFAULT_FORM }, activeTab: 'planner',
    selectedPipeIds: [], selectionMode: false,
  }),
}));

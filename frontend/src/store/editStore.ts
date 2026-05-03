import { create } from 'zustand';

export type EditTool = 'select' | 'addNode' | 'addPipe' | 'delete' | 'pipeStatus';

interface EditState {
  isEditMode: boolean;
  activeTool: EditTool;
  pipeSourceNodeId: string | null;
  cursorLatLng: { lat: number; lng: number } | null;
  defaultDiameterMm: number;
  defaultCategory: 'service' | 'distribution' | 'trunk';
  isSaving: boolean;
  lastError: string | null;

  toggleEditMode: () => void;
  setActiveTool: (tool: EditTool) => void;
  setPipeSourceNode: (nodeId: string | null) => void;
  setCursorLatLng: (latlng: { lat: number; lng: number } | null) => void;
  setDefaultDiameterMm: (mm: number) => void;
  setDefaultCategory: (cat: 'service' | 'distribution' | 'trunk') => void;
  setSaving: (v: boolean) => void;
  setError: (msg: string | null) => void;
}

export const useEditStore = create<EditState>((set) => ({
  isEditMode: false,
  activeTool: 'select',
  pipeSourceNodeId: null,
  cursorLatLng: null,
  defaultDiameterMm: 100,
  defaultCategory: 'service',
  isSaving: false,
  lastError: null,

  toggleEditMode: () =>
    set((s) => ({
      isEditMode: !s.isEditMode,
      activeTool: 'select',
      pipeSourceNodeId: null,
      cursorLatLng: null,
      lastError: null,
    })),

  setActiveTool: (tool) =>
    set({ activeTool: tool, pipeSourceNodeId: null, cursorLatLng: null }),

  setPipeSourceNode: (nodeId) => set({ pipeSourceNodeId: nodeId }),

  setCursorLatLng: (latlng) => set({ cursorLatLng: latlng }),

  setDefaultDiameterMm: (mm) => set({ defaultDiameterMm: mm }),

  setDefaultCategory: (cat) => set({ defaultCategory: cat }),

  setSaving: (v) => set({ isSaving: v }),

  setError: (msg) => set({ lastError: msg }),
}));

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage } from '../types/simulation';
import { agentService } from '../services/agentService';
import { useSimulationStore } from './simulationStore';
import { useNetworkStore } from './networkStore';

// Generate a stable session ID for this browser session
const SESSION_ID = uuidv4();

interface ChatStore {
  messages: ChatMessage[];
  sessionId: string;
  isLoading: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
  clearChat: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  sessionId: SESSION_ID,
  isLoading: false,
  error: null,

  sendMessage: async (text: string) => {
    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    set(s => ({ messages: [...s.messages, userMsg], isLoading: true, error: null }));

    try {
      const response = await agentService.sendMessage(get().sessionId, text);

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: response.reply,
        tool_calls: response.tool_calls,
        affected_nodes: response.affected_nodes,
        timestamp: new Date().toISOString(),
      };
      set(s => ({ messages: [...s.messages, assistantMsg], isLoading: false }));

      // Sync affected nodes into simulation store
      if (response.affected_nodes.length > 0) {
        useSimulationStore.getState().setAffectedNodes(response.affected_nodes);
      }

      // Refresh simulation results if network state changed
      if (response.network_state_changed) {
        useSimulationStore.getState().fetchResults();
        // Update closed pipes in network store
        const closedFromTools = response.tool_calls
          .filter(tc => tc.tool === 'shutdown_pipes')
          .flatMap(tc => (tc.output as any)?.closed ?? []);
        if (closedFromTools.length > 0) {
          const store = useNetworkStore.getState();
          store.setClosedPipes([...store.closedPipes, ...closedFromTools]);
        }
      }
    } catch (e: any) {
      set(s => ({
        messages: [...s.messages, {
          role: 'assistant',
          content: `Error: ${e.message}`,
          timestamp: new Date().toISOString(),
        }],
        isLoading: false,
        error: e.message,
      }));
    }
  },

  clearChat: () => {
    agentService.clearSession(get().sessionId).catch(() => {});
    set({ messages: [], error: null });
  },
}));

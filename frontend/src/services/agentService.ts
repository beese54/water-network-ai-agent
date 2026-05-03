import api from './api';
import type { ChatResponse } from '../types/simulation';

export const agentService = {
  sendMessage: (session_id: string, message: string) =>
    api.post<ChatResponse>('/agent/chat', { session_id, message }, { timeout: 120000 }).then(r => r.data),
  clearSession: (session_id: string) =>
    api.delete(`/agent/chat/${session_id}`).then(r => r.data),
};

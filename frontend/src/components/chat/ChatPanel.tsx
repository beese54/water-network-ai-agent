import React, { useEffect, useRef } from 'react';

const THINKING_STYLE = `
@keyframes agentPulse {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40%           { transform: scale(1.0); opacity: 1.0; }
}
`;
import { useChatStore } from '../../store/chatStore';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';

const ChatPanel: React.FC = () => {
  const messages = useChatStore(s => s.messages);
  const isLoading = useChatStore(s => s.isLoading);
  const sendMessage = useChatStore(s => s.sendMessage);
  const clearChat = useChatStore(s => s.clearChat);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#fff', borderLeft: '1px solid #e0e0e0',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid #e0e0e0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: '#1565c0',
      }}>
        <div>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>Hydraulic Analysis Agent</div>
          <div style={{ color: '#bbdefb', fontSize: 11 }}>Bukit Batok Water Distribution</div>
        </div>
        <button
          onClick={clearChat}
          style={{
            background: 'rgba(255,255,255,0.15)', border: 'none',
            color: '#fff', borderRadius: 4, padding: '3px 8px',
            cursor: 'pointer', fontSize: 11,
          }}
        >
          Clear
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}
      >
        {messages.length === 0 && (
          <div style={{ color: '#9e9e9e', fontSize: 13, textAlign: 'center', marginTop: 24 }}>
            <div style={{ marginBottom: 8 }}>Ask me about the Bukit Batok water network.</div>
            <div style={{ fontSize: 12 }}>
              Try: "Shut pipe T001 for maintenance — which zones lose pressure?"
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}
        {isLoading && (
          <>
            <style>{THINKING_STYLE}</style>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', background: '#e3f2fd',
              borderRadius: 8, margin: '4px 0',
            }}>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: '#1565c0',
                    animation: `agentPulse 1.2s ease-in-out infinite`,
                    animationDelay: `${i * 0.18}s`,
                  }} />
                ))}
              </div>
              <span style={{ fontSize: 12, color: '#1565c0', fontWeight: 500 }}>
                Analysing network — running hydraulic simulation, please wait...
              </span>
            </div>
          </>
        )}
      </div>

      {/* Input */}
      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
};

export default ChatPanel;

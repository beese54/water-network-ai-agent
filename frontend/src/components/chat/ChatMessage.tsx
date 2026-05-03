import React from 'react';
import type { ChatMessage as ChatMessageType } from '../../types/simulation';
import ToolCallTrace from './ToolCallTrace';

interface Props {
  message: ChatMessageType;
}

const ChatMessage: React.FC<Props> = ({ message }) => {
  const isUser = message.role === 'user';
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 10,
    }}>
      <div style={{
        maxWidth: '85%',
        background: isUser ? '#1565c0' : '#f5f5f5',
        color: isUser ? '#fff' : '#212121',
        borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
        padding: '8px 12px',
        fontSize: 13,
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {message.content}
      </div>
      {!isUser && message.tool_calls && message.tool_calls.length > 0 && (
        <div style={{ maxWidth: '85%' }}>
          <ToolCallTrace toolCalls={message.tool_calls} />
        </div>
      )}
    </div>
  );
};

export default ChatMessage;

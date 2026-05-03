import React, { useState } from 'react';
import type { KeyboardEvent } from 'react';

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const ChatInput: React.FC<Props> = ({ onSend, disabled, placeholder }) => {
  const [value, setValue] = useState('');

  const handleSend = () => {
    const trimmed = value.trim();
    if (trimmed) {
      onSend(trimmed);
      setValue('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ display: 'flex', gap: 8, padding: '8px 12px', borderTop: '1px solid #e0e0e0' }}>
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder ?? 'Ask about the network or request a shutdown analysis...'}
        rows={2}
        style={{
          flex: 1, resize: 'none', border: '1px solid #bdbdbd',
          borderRadius: 6, padding: '6px 10px', fontSize: 13,
          outline: 'none', fontFamily: 'inherit',
        }}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        style={{
          background: disabled ? '#bdbdbd' : '#1565c0',
          color: '#fff', border: 'none', borderRadius: 6,
          padding: '0 16px', cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 13, fontWeight: 600,
        }}
      >
        Send
      </button>
    </div>
  );
};

export default ChatInput;

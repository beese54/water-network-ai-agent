import React, { useState } from 'react';
import type { ToolCallRecord } from '../../types/simulation';

interface Props {
  toolCalls: ToolCallRecord[];
}

const ToolCallTrace: React.FC<Props> = ({ toolCalls }) => {
  const [expanded, setExpanded] = useState(false);
  if (!toolCalls.length) return null;

  return (
    <div style={{ marginTop: 6, fontSize: 11, color: '#555' }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#1565c0', fontSize: 11, padding: 0, textDecoration: 'underline',
        }}
      >
        {expanded ? 'Hide' : 'Show'} {toolCalls.length} tool call{toolCalls.length > 1 ? 's' : ''}
      </button>
      {expanded && (
        <div style={{ marginTop: 4 }}>
          {toolCalls.map((tc, i) => (
            <details key={i} style={{ marginBottom: 4 }}>
              <summary style={{ cursor: 'pointer', color: '#7b1fa2', fontFamily: 'monospace' }}>
                {tc.tool}({Object.keys(tc.input).join(', ')})
              </summary>
              <div style={{ background: '#f5f5f5', borderRadius: 4, padding: '4px 8px', marginTop: 2 }}>
                <div style={{ color: '#555', marginBottom: 2 }}>Input:</div>
                <pre style={{ margin: 0, fontSize: 10, overflow: 'auto' }}>
                  {JSON.stringify(tc.input, null, 2)}
                </pre>
                <div style={{ color: '#555', marginTop: 4, marginBottom: 2 }}>Output:</div>
                <pre style={{ margin: 0, fontSize: 10, overflow: 'auto', maxHeight: 120 }}>
                  {JSON.stringify(tc.output, null, 2)}
                </pre>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
};

export default ToolCallTrace;

import React from 'react';
import type { AffectedNode, NodeResult } from '../../types/simulation';
import { pressureToColor } from '../../utils/pressureColor';
import { useSimulationStore } from '../../store/simulationStore';

interface Props {
  nodes: (AffectedNode | NodeResult)[];
}

const AffectedNodesList: React.FC<Props> = ({ nodes }) => {
  const focusedNodeId = useSimulationStore((s) => s.focusedNodeId);
  const setFocusedNode = useSimulationStore((s) => s.setFocusedNode);

  if (!nodes.length) return null;

  return (
    <div style={{ overflowY: 'auto', maxHeight: 140 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#fafafa', borderBottom: '1px solid #e0e0e0' }}>
            <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 600 }}>Node</th>
            <th style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>Pressure</th>
            <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 600 }}>Zone</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((n) => {
            const nodeId = 'node_id' in n ? n.node_id : (n as any).node_id;
            const pressure = n.pressure_bar;
            const zone = ('zone_display' in n && n.zone_display) ? n.zone_display : (n.zone ?? '');
            const isFocused = focusedNodeId === nodeId;
            return (
              <tr
                key={nodeId}
                onClick={() => setFocusedNode(isFocused ? null : nodeId)}
                style={{
                  borderBottom: '1px solid #f5f5f5',
                  cursor: 'pointer',
                  background: isFocused ? '#e3f2fd' : undefined,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { if (!isFocused) (e.currentTarget as HTMLElement).style.background = '#f5f5f5'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = isFocused ? '#e3f2fd' : ''; }}
              >
                <td style={{ padding: '4px 8px', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 10, opacity: 0.6 }}>&#x1F4CD;</span>
                  {nodeId}
                </td>
                <td style={{
                  padding: '4px 8px', textAlign: 'right', fontWeight: 600,
                  color: pressureToColor(pressure),
                }}>
                  {pressure.toFixed(2)} bar
                </td>
                <td style={{ padding: '4px 8px', color: '#555' }}>{zone}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default AffectedNodesList;

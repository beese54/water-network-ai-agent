import React from 'react';
import type { NetworkNode, NetworkPipe } from '../../types/network';
import type { NodeResult, PipeResult } from '../../types/simulation';

interface NodeSelection {
  type: 'node';
  node: NetworkNode;
  result?: NodeResult;
}

interface PipeSelection {
  type: 'pipe';
  pipe: NetworkPipe;
  result?: PipeResult;
}

export type MapSelection = NodeSelection | PipeSelection;

interface Props {
  selection: MapSelection | null;
  onClose: () => void;
  nodeElevMap?: Record<string, number>;
  reservoirHead?: number;
}

const row = (label: string, value: React.ReactNode) => (
  <tr key={label}>
    <td style={{ color: '#9e9e9e', paddingRight: 12, whiteSpace: 'nowrap', fontSize: 12 }}>{label}</td>
    <td style={{ fontWeight: 600, fontSize: 13 }}>{value}</td>
  </tr>
);

const pressureColor = (p: number) => p < 1.0 ? '#e53935' : p < 2.0 ? '#f57c00' : '#2e7d32';

const MapInfoPanel: React.FC<Props> = ({ selection, onClose, nodeElevMap, reservoirHead = 145 }) => {
  if (!selection) return null;

  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 24,
    left: 16,
    zIndex: 1000,
    background: 'rgba(255,255,255,0.97)',
    borderRadius: 8,
    boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
    padding: '12px 16px',
    minWidth: 220,
    maxWidth: 280,
    fontFamily: 'inherit',
  };

  const header = (title: string, sub: string, dotColor?: string) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {dotColor && (
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        )}
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
          <div style={{ fontSize: 11, color: '#757575' }}>{sub}</div>
        </div>
      </div>
      <button
        onClick={onClose}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9e9e9e', padding: 0, lineHeight: 1 }}
      >×</button>
    </div>
  );

  if (selection.type === 'node') {
    const { node, result } = selection;
    const pressure = result?.pressure_bar;
    const pColor = pressure !== undefined ? pressureColor(pressure) : '#757575';
    const staticPressure = (reservoirHead - node.elevation_m) / 10.197;

    return (
      <div style={panelStyle}>
        {header(node.id, node.zone?.replace(/_/g, ' ') ?? 'Junction', pColor)}
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {pressure !== undefined && row('Pressure', <span style={{ color: pColor }}>{pressure.toFixed(2)} bar{pressure < 1.0 ? ' ⚠' : ''}</span>)}
            {result?.head_m !== undefined && row('Head', `${result.head_m.toFixed(2)} m`)}
            {result?.demand_lps !== undefined && row('Demand', `${result.demand_lps.toFixed(3)} L/s`)}
            {row('Elevation', (
              <span>
                {node.elevation_m.toFixed(1)} m ASL
                <span style={{ color: '#9e9e9e', fontSize: 11, marginLeft: 6 }}>
                  ({(reservoirHead - node.elevation_m).toFixed(0)}m below reservoir)
                </span>
              </span>
            ))}
            {row('Static pressure', (
              <span style={{ color: '#546e7a', fontSize: 12 }}>
                ~{staticPressure.toFixed(2)} bar
                <span style={{ color: '#9e9e9e', fontSize: 11, marginLeft: 6 }}>
                  ({reservoirHead}m − {node.elevation_m.toFixed(0)}m) / 10.197
                </span>
              </span>
            ))}
            {pressure === undefined && row('Pressure', 'Run simulation first')}
            {node.depth_from_reservoir >= 0 && row('Network depth', (
              <span>{node.depth_from_reservoir} hops from reservoir</span>
            ))}
            {node.upstream_pipe_ids?.length > 0 && row('Fed by', (
              <span style={{ fontSize: 11, color: '#1565c0' }}>{node.upstream_pipe_ids.join(', ')}</span>
            ))}
            {node.downstream_pipe_ids?.length > 0 && row('Feeds', (
              <span style={{ fontSize: 11, color: '#2e7d32' }}>{node.downstream_pipe_ids.join(', ')}</span>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const { pipe, result } = selection;
  const isClosed = pipe.status === 'closed' || result?.status === 'Closed';
  const categoryColors: Record<string, string> = {
    trunk: '#1565c0', distribution: '#1976d2', service: '#90a4ae', valve: '#7b1fa2',
  };
  const pipeColor = isClosed ? '#e53935' : (categoryColors[pipe.category] ?? '#607d8b');
  const elevStart = nodeElevMap?.[pipe.start_node];
  const elevEnd = nodeElevMap?.[pipe.end_node];
  const elevDiff = elevStart !== undefined && elevEnd !== undefined ? elevEnd - elevStart : undefined;

  return (
    <div style={panelStyle}>
      {header(pipe.id, `${pipe.category} · DN${pipe.diameter_mm}`, pipeColor)}
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          {pipe.road_name && row('Road', <span style={{ color: '#37474f' }}>{pipe.road_name}</span>)}
          {result ? (
            <>
              {row('Flow', (
                <span title={result.flow_lps < 0 ? 'Reverse flow (end → start)' : 'Forward flow (start → end)'}>
                  {result.flow_lps >= 0 ? '→' : '←'}{' '}
                  {Math.abs(result.flow_lps).toFixed(3)} L/s
                  {result.flow_lps < 0 && <span style={{ color: '#f57c00', fontSize: 11, marginLeft: 4 }}>reverse</span>}
                </span>
              ))}
              {row('Velocity', `${Math.abs(result.velocity_mps).toFixed(3)} m/s`)}
            </>
          ) : (
            row('Flow / Velocity', 'Run simulation first')
          )}
          {row('Length', `${pipe.length_m.toFixed(0)} m`)}
          {row('Diameter', `DN${pipe.diameter_mm}`)}
          {pipe.upstream_node_id && row('Upstream node', (
            <span style={{ color: '#1565c0' }}>{pipe.upstream_node_id}
              <span style={{ color: '#9e9e9e', fontSize: 11, marginLeft: 4 }}>(reservoir side)</span>
            </span>
          ))}
          {pipe.downstream_node_id && row('Downstream node', (
            <span style={{ color: '#2e7d32' }}>{pipe.downstream_node_id}
              <span style={{ color: '#9e9e9e', fontSize: 11, marginLeft: 4 }}>(demand side)</span>
            </span>
          ))}
          {elevStart !== undefined && row('Start node elev', `${pipe.start_node}  ${elevStart.toFixed(1)} m ASL`)}
          {elevEnd !== undefined && row('End node elev', `${pipe.end_node}  ${elevEnd.toFixed(1)} m ASL`)}
          {elevDiff !== undefined && row('Elevation diff', (
            <span style={{ color: elevDiff > 0 ? '#e65100' : '#1565c0' }}>
              {elevDiff > 0 ? '+' : ''}{elevDiff.toFixed(1)} m
              <span style={{ color: '#9e9e9e', fontSize: 11, marginLeft: 4 }}>
                ({elevDiff > 0 ? 'uphill' : 'downhill'})
              </span>
            </span>
          ))}
          {row('Status', <span style={{ color: isClosed ? '#e53935' : '#2e7d32', fontWeight: 700 }}>{isClosed ? 'CLOSED' : 'Open'}</span>)}
        </tbody>
      </table>
    </div>
  );
};

export default MapInfoPanel;

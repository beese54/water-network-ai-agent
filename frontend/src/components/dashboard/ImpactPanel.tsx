import React, { useState } from 'react';
import type { NodeImpact, PipeImpact } from '../../types/simulation';
import { useSimulationStore } from '../../store/simulationStore';

interface Props {
  nodeImpacts: NodeImpact[];
  pipeImpacts: PipeImpact[];
  pipeIds: string[];
}

const deltaColor = (d: number): string => {
  if (d < -0.1) return '#e53935';
  if (d < 0)    return '#f57c00';
  if (d > 0)    return '#2e7d32';
  return '#9e9e9e';
};

const fmtDelta = (d: number, unit: string) =>
  `${d >= 0 ? '+' : ''}${d.toFixed(3)} ${unit}`;

const TH: React.CSSProperties = {
  textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#757575',
  padding: '3px 8px', borderBottom: '1px solid #e0e0e0', whiteSpace: 'nowrap',
};
const TD: React.CSSProperties = {
  fontSize: 11, padding: '3px 8px', borderBottom: '1px solid #f5f5f5', verticalAlign: 'top',
};

const PipeTag: React.FC<{ id: string; color: string }> = ({ id, color }) => (
  <span style={{
    display: 'inline-block', fontSize: 9, padding: '1px 4px',
    background: color + '22', color, border: `1px solid ${color}66`,
    borderRadius: 3, marginRight: 2, marginBottom: 1,
  }}>{id}</span>
);

const NodeTable: React.FC<{
  nodes: NodeImpact[];
  title: string;
  subtitle?: string;
  onNodeClick: (id: string) => void;
}> = ({ nodes, title, subtitle, onNodeClick }) => {
  if (!nodes.length) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#424242', marginBottom: 2 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 10, color: '#9e9e9e', marginBottom: 6 }}>{subtitle}</div>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 520 }}>
          <thead>
            <tr>
              {['Node', 'Depth', 'Zone', 'Elev (m)', 'Baseline', 'Shutdown', 'Δ Pressure', 'Fed by (upstream)', 'Feeds (downstream)'].map(h => (
                <th key={h} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nodes.map(n => (
              <tr key={n.node_id}>
                <td style={{ ...TD, fontWeight: 600 }}>
                  <button
                    onClick={() => onNodeClick(n.node_id)}
                    style={{
                      background: 'none', border: 'none', padding: 0,
                      cursor: 'pointer', fontFamily: 'monospace', fontWeight: 600,
                      fontSize: 11, color: '#1565c0', textDecoration: 'underline',
                    }}
                    title={`Show ${n.node_id} on map`}
                  >
                    {n.node_id}
                  </button>
                </td>
                <td style={{ ...TD, color: '#546e7a', textAlign: 'center' }}>
                  {n.depth_from_reservoir >= 0 ? n.depth_from_reservoir : '—'}
                </td>
                <td style={{ ...TD, color: '#757575' }}>{n.zone?.replace(/_/g, ' ') ?? '—'}</td>
                <td style={TD}>{n.elevation_m.toFixed(1)}</td>
                <td style={TD}>{n.baseline_pressure_bar.toFixed(3)} bar</td>
                <td style={TD}>{n.shutdown_pressure_bar.toFixed(3)} bar</td>
                <td style={{ ...TD, color: deltaColor(n.pressure_delta_bar), fontWeight: 700 }}>
                  {fmtDelta(n.pressure_delta_bar, 'bar')}
                </td>
                <td style={TD}>
                  {n.upstream_pipe_ids.length > 0
                    ? n.upstream_pipe_ids.map(id => <PipeTag key={id} id={id} color="#1565c0" />)
                    : <span style={{ color: '#9e9e9e' }}>—</span>}
                </td>
                <td style={TD}>
                  {n.downstream_pipe_ids.length > 0
                    ? n.downstream_pipe_ids.map(id => <PipeTag key={id} id={id} color="#2e7d32" />)
                    : <span style={{ color: '#9e9e9e' }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ImpactPanel: React.FC<Props> = ({ nodeImpacts, pipeImpacts, pipeIds }) => {
  const [showPipes, setShowPipes] = useState(false);
  const setFocusedNode = useSimulationStore((s) => s.setFocusedNode);

  // Isolated nodes: topologically cut off (BFS unreachable) — full pressure loss
  const isolated = nodeImpacts
    .filter(n => n.side === 'downstream')
    .sort((a, b) => a.pressure_delta_bar - b.pressure_delta_bar);

  // Pressure-affected upstream nodes: reachable but significant pressure change
  const pressureDrop = nodeImpacts
    .filter(n => n.side === 'upstream' && n.pressure_delta_bar < -0.01)
    .sort((a, b) => a.pressure_delta_bar - b.pressure_delta_bar);

  const pressureGain = nodeImpacts
    .filter(n => n.side === 'upstream' && n.pressure_delta_bar > 0.01)
    .sort((a, b) => b.pressure_delta_bar - a.pressure_delta_bar);

  const shutdownPipes = pipeImpacts.filter(p => p.side === 'shutdown');
  const downstreamPipes = pipeImpacts.filter(p => p.side === 'downstream');

  const totalAffected = isolated.length + pressureDrop.length;

  return (
    <div style={{ fontSize: 12 }}>
      {/* Summary strip */}
      <div style={{
        display: 'flex', gap: 14, marginBottom: 10,
        background: '#e3f2fd', borderRadius: 6, padding: '8px 12px',
        flexWrap: 'wrap', alignItems: 'center',
      }}>
        <div>
          <span style={{ fontWeight: 700, color: '#1565c0' }}>Shutdown: </span>
          {pipeIds.join(', ')}
        </div>
        <div style={{ borderLeft: '1px solid #90caf9', paddingLeft: 14 }}>
          <span style={{ fontWeight: 700, color: '#e53935' }}>{isolated.length}</span>
          <span style={{ color: '#555' }}> isolated nodes (no supply)</span>
        </div>
        <div>
          <span style={{ fontWeight: 700, color: '#f57c00' }}>{pressureDrop.length}</span>
          <span style={{ color: '#555' }}> nodes with pressure drop</span>
        </div>
        {pressureGain.length > 0 && (
          <div>
            <span style={{ fontWeight: 700, color: '#2e7d32' }}>{pressureGain.length}</span>
            <span style={{ color: '#555' }}> nodes with pressure gain</span>
          </div>
        )}
        <div>
          <span style={{ fontWeight: 700, color: '#f57c00' }}>{downstreamPipes.length}</span>
          <span style={{ color: '#555' }}> pipes lose flow</span>
        </div>
      </div>

      {/* Closed pipes info */}
      {shutdownPipes.length > 0 && (
        <div style={{ marginBottom: 10, padding: '6px 10px', background: '#fce4ec', borderRadius: 5 }}>
          <span style={{ fontWeight: 700, color: '#c62828', fontSize: 11 }}>Closed: </span>
          {shutdownPipes.map(p => (
            <span key={p.pipe_id} style={{ fontSize: 11, marginRight: 12 }}>
              <strong>{p.pipe_id}</strong> ({p.category}) ·{' '}
              upstream: <span style={{ color: '#1565c0' }}>{p.start_node}</span>,{' '}
              downstream: <span style={{ color: '#e53935' }}>{p.end_node}</span> ·{' '}
              was {p.baseline_flow_lps.toFixed(2)} L/s
            </span>
          ))}
        </div>
      )}

      {/* Isolated downstream nodes */}
      <NodeTable
        nodes={isolated}
        title={`Isolated nodes — fully cut off (${isolated.length})`}
        subtitle="These nodes have no supply path after shutdown. Network depth shows hops from reservoir."
        onNodeClick={setFocusedNode}
      />

      {/* Upstream nodes with pressure drop */}
      {pressureDrop.length > 0 && (
        <NodeTable
          nodes={pressureDrop.slice(0, 30)}
          title={`Upstream nodes — pressure drop (${pressureDrop.length})`}
          subtitle="Still connected but pressure reduced due to rerouting. Sorted by largest loss first."
          onNodeClick={setFocusedNode}
        />
      )}

      {/* Upstream nodes with pressure gain */}
      {pressureGain.length > 0 && (
        <NodeTable
          nodes={pressureGain.slice(0, 20)}
          title={`Upstream nodes — pressure gain (${pressureGain.length})`}
          subtitle="Head backs up when downstream demand is removed."
          onNodeClick={setFocusedNode}
        />
      )}

      {/* Pipe flow impact (collapsible) */}
      {downstreamPipes.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <button
            onClick={() => setShowPipes(v => !v)}
            style={{
              background: 'none', border: '1px solid #bdbdbd', borderRadius: 4,
              cursor: 'pointer', fontSize: 11, padding: '3px 10px', marginBottom: 6,
              color: '#424242',
            }}
          >
            {showPipes ? '▼' : '▶'} Downstream pipe flow changes ({downstreamPipes.length} pipes lose flow)
          </button>

          {showPipes && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 540 }}>
                <thead>
                  <tr>
                    {['Pipe', 'Category', 'Upstream node', 'Downstream node', 'Baseline (L/s)', 'Shutdown (L/s)', 'Δ Flow', 'Baseline vel (m/s)', 'Shutdown vel (m/s)'].map(h => (
                      <th key={h} style={TH}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {downstreamPipes
                    .sort((a, b) => Math.abs(b.flow_delta_lps) - Math.abs(a.flow_delta_lps))
                    .map(p => (
                      <tr key={p.pipe_id}>
                        <td style={{ ...TD, fontWeight: 600 }}>{p.pipe_id}</td>
                        <td style={{ ...TD, color: '#757575' }}>{p.category}</td>
                        <td style={{ ...TD, color: '#1565c0' }}>{p.start_node}</td>
                        <td style={{ ...TD, color: '#e53935' }}>{p.end_node}</td>
                        <td style={TD}>{p.baseline_flow_lps.toFixed(3)}</td>
                        <td style={TD}>{p.shutdown_flow_lps.toFixed(3)}</td>
                        <td style={{ ...TD, color: deltaColor(p.flow_delta_lps), fontWeight: 700 }}>
                          {fmtDelta(p.flow_delta_lps, 'L/s')}
                        </td>
                        <td style={TD}>{p.baseline_velocity_mps.toFixed(3)}</td>
                        <td style={TD}>{p.shutdown_velocity_mps.toFixed(3)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {totalAffected === 0 && (
        <div style={{ color: '#9e9e9e', textAlign: 'center', padding: '20px 0' }}>
          No significant pressure changes detected. The network remained fully connected with minimal impact.
        </div>
      )}
    </div>
  );
};

export default ImpactPanel;

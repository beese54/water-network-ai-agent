import React from 'react';
import type { SimulationSummary } from '../../types/simulation';

interface Props {
  summary: SimulationSummary;
}

const Stat: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div style={{ textAlign: 'center', flex: 1 }}>
    <div style={{ fontSize: 11, color: '#757575' }}>{label}</div>
    <div style={{
      fontSize: 16, fontWeight: 700,
      color: highlight ? '#e53935' : '#212121',
    }}>{value}</div>
  </div>
);

const SimulationStats: React.FC<Props> = ({ summary }) => (
  <div style={{
    display: 'flex', gap: 4, padding: '8px 12px',
    background: '#f5f5f5', borderBottom: '1px solid #e0e0e0',
    borderTop: '1px solid #e0e0e0',
  }}>
    <Stat label="Min Pressure" value={`${summary.min_pressure_bar.toFixed(2)} bar`} highlight={summary.min_pressure_bar < 1.0} />
    <div style={{ width: 1, background: '#e0e0e0' }} />
    <Stat label="Avg Pressure" value={`${summary.avg_pressure_bar.toFixed(2)} bar`} />
    <div style={{ width: 1, background: '#e0e0e0' }} />
    <Stat label="Max Pressure" value={`${summary.max_pressure_bar.toFixed(2)} bar`} />
    <div style={{ width: 1, background: '#e0e0e0' }} />
    <Stat
      label="Below 1 bar"
      value={`${summary.nodes_below_threshold} / ${summary.total_nodes}`}
      highlight={summary.nodes_below_threshold > 0}
    />
  </div>
);

export default SimulationStats;

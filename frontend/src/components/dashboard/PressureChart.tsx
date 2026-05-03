import React from 'react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ReferenceArea, ResponsiveContainer,
} from 'recharts';
import type { HourlyPressureSummary } from '../../types/simulation';

interface Props {
  baseline: HourlyPressureSummary[];
  shutdown: HourlyPressureSummary[];
  thresholdBar?: number;
  isolatedCount?: number;
  totalNodes?: number;
}

const ENTRIES = [
  { key: 'baseline_avg', label: 'Baseline avg', color: '#1976d2', dashed: false, width: 2 },
  { key: 'baseline_min', label: 'Baseline min', color: '#1976d2', dashed: true,  width: 1.5 },
  { key: 'shutdown_avg', label: 'Shutdown avg', color: '#e53935', dashed: false, width: 2 },
  { key: 'shutdown_min', label: 'Shutdown min', color: '#e53935', dashed: true,  width: 1.5 },
];

const renderLegend = () => (
  <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', fontSize: 11, paddingTop: 4 }}>
    {ENTRIES.map(e => (
      <div key={e.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <svg width={28} height={10} style={{ flexShrink: 0 }}>
          <line
            x1={0} y1={5} x2={28} y2={5}
            stroke={e.color}
            strokeWidth={e.width}
            strokeDasharray={e.dashed ? '5 3' : undefined}
          />
        </svg>
        <span style={{ color: '#444' }}>{e.label}</span>
      </div>
    ))}
  </div>
);

const PressureChart: React.FC<Props> = ({
  baseline, shutdown, thresholdBar = 1.0, isolatedCount = 0, totalNodes,
}) => {
  const data = baseline.map((b, i) => ({
    hour: b.hour,
    label: `${String(b.hour).padStart(2, '0')}:00`,
    baseline_avg: b.avg_pressure_bar,
    baseline_min: b.min_pressure_bar,
    shutdown_avg: shutdown[i]?.avg_pressure_bar ?? null,
    shutdown_min: shutdown[i]?.min_pressure_bar ?? null,
    multiplier: b.demand_multiplier,
    below_base: b.nodes_below_threshold,
    below_shut: shutdown[i]?.nodes_below_threshold ?? 0,
  }));

  const customTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = data.find(r => r.label === label);
    return (
      <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 4, padding: '8px 10px', fontSize: 11 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{label} (×{d?.multiplier.toFixed(2)} demand)</div>
        {payload.map((p: any) => (
          <div key={p.name} style={{ color: p.color }}>
            {p.name}: {p.value?.toFixed(2)} bar
          </div>
        ))}
        {d && <div style={{ color: '#f57c00', marginTop: 2 }}>Below threshold: base={d.below_base} / shut={d.below_shut}</div>}
      </div>
    );
  };

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 6, right: 16, bottom: 16, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            interval={2}
            label={{ value: 'Hour of day', position: 'insideBottom', offset: -8, fontSize: 10 }}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            label={{ value: 'Pressure (bar)', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10 }}
          />
          <Tooltip content={customTooltip} />
          <Legend content={renderLegend} />

          <ReferenceArea x1="06:00" x2="09:00" fill="#fff9c4" fillOpacity={0.5} />
          <ReferenceArea x1="17:00" x2="20:00" fill="#fff9c4" fillOpacity={0.5} />

          <ReferenceLine y={thresholdBar} stroke="#f57c00" strokeDasharray="4 2"
            label={{ value: 'Min 1 bar', position: 'right', fontSize: 9, fill: '#f57c00' }} />

          {ENTRIES.map(e => (
            <Line
              key={e.key}
              name={e.label}
              dataKey={e.key}
              stroke={e.color}
              strokeWidth={e.width}
              strokeDasharray={e.dashed ? '5 3' : undefined}
              dot={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>

      {isolatedCount > 0 && (
        <div style={{
          fontSize: 10, color: '#b71c1c', marginTop: 4,
          background: '#ffebee', borderRadius: 4, padding: '4px 8px',
          borderLeft: '3px solid #e53935',
        }}>
          <strong>{isolatedCount} node{isolatedCount !== 1 ? 's' : ''} have zero supply</strong>
          {totalNodes ? ` (out of ${totalNodes} total)` : ''}
          {' '}— avg &amp; min lines show the network-wide mean including these isolated nodes.
          Shutdown avg remains high because the majority of nodes upstream still have normal pressure.
          See the <strong>Impact Analysis</strong> tab for isolated node detail.
        </div>
      )}
    </div>
  );
};

export default PressureChart;

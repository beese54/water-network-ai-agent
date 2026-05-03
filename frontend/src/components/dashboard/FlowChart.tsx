import React from 'react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceArea, ResponsiveContainer,
} from 'recharts';
import type { HourlyFlowSummary } from '../../types/simulation';

interface Props {
  baselineFlow: HourlyFlowSummary[];
  shutdownFlow: HourlyFlowSummary[];
  pipeIds: string[];
}

const PALETTE = ['#1976d2', '#43a047', '#7b1fa2', '#e65100'];

const FlowChart: React.FC<Props> = ({ baselineFlow, shutdownFlow, pipeIds }) => {
  // Check if all shutdown flows are zero (pipe fully closed)
  const allZero = shutdownFlow.every(f => f.flow_lps === 0);

  // Pivot: one row per hour with {pipeId}_base and {pipeId}_shut columns
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const data = hours.map(h => {
    const row: Record<string, unknown> = { hour: h, label: `${String(h).padStart(2, '0')}:00` };
    pipeIds.forEach(pid => {
      const b = baselineFlow.find(f => f.hour === h && f.pipe_id === pid);
      const s = shutdownFlow.find(f => f.hour === h && f.pipe_id === pid);
      row[`${pid}_base`] = b ? Math.abs(b.flow_lps) : null;
      row[`${pid}_shut`] = s ? Math.abs(s.flow_lps) : null;
    });
    return row;
  });

  if (allZero) {
    return (
      <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#757575', fontSize: 12 }}>
        Pipe fully closed — no flow in shutdown scenario.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
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
          label={{ value: 'Flow (L/s)', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10 }}
        />
        <Tooltip
          formatter={(v) => [`${Number(v).toFixed(2)} L/s`]}
          labelFormatter={(l) => String(l)}
          contentStyle={{ fontSize: 11 }}
        />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />

        <ReferenceArea x1="06:00" x2="09:00" fill="#fff9c4" fillOpacity={0.5} />
        <ReferenceArea x1="17:00" x2="20:00" fill="#fff9c4" fillOpacity={0.5} />

        {pipeIds.map((pid, idx) => {
          const color = PALETTE[idx % PALETTE.length];
          return (
            <React.Fragment key={pid}>
              <Line
                name={`${pid} baseline`}
                dataKey={`${pid}_base`}
                stroke={color}
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={false}
                connectNulls
              />
              <Line
                name={`${pid} shutdown`}
                dataKey={`${pid}_shut`}
                stroke={color}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </React.Fragment>
          );
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default FlowChart;

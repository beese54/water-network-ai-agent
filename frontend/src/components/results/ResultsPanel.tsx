import React from 'react';
import { useSimulationStore } from '../../store/simulationStore';
import SimulationStats from './SimulationStats';
import AffectedNodesList from './AffectedNodesList';

const THRESHOLD_BAR = 1.0;

const ResultsPanel: React.FC = () => {
  const result = useSimulationStore(s => s.result);
  const affectedFromAgent = useSimulationStore(s => s.affectedNodes);

  if (!result) return null;

  // Use agent-provided affected nodes if available, otherwise compute from result
  const affectedNodes = affectedFromAgent.length > 0
    ? affectedFromAgent
    : result.node_results.filter(n => n.pressure_bar < THRESHOLD_BAR)
        .sort((a, b) => a.pressure_bar - b.pressure_bar);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <SimulationStats summary={result.summary} />

      <div style={{
        padding: '6px 12px', background: '#fff',
        fontSize: 12, color: '#555', borderBottom: '1px solid #eee',
      }}>
        {result.summary.nodes_below_threshold > 0
          ? <span style={{ color: '#e53935', fontWeight: 600 }}>
              {result.summary.nodes_below_threshold} node(s) below 1 bar threshold
            </span>
          : <span style={{ color: '#43a047', fontWeight: 600 }}>
              All nodes meet the 1 bar minimum — no impact detected
            </span>
        }
        <span style={{ color: '#9e9e9e', marginLeft: 8 }}>
          Simulation: {result.simulation_id} · {result.duration_ms}ms
        </span>
      </div>

      {affectedNodes.length > 0 && (
        <AffectedNodesList nodes={affectedNodes} />
      )}
    </div>
  );
};

export default ResultsPanel;

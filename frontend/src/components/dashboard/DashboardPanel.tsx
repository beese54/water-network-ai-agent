import React from 'react';
import { useShutdownStore } from '../../store/shutdownStore';
import ShutdownPlannerForm from './ShutdownPlannerForm';
import PressureChart from './PressureChart';
import FlowChart from './FlowChart';
import ImpactPanel from './ImpactPanel';

const TAB_LABELS: { key: 'planner' | 'pressure' | 'flow' | 'impact'; label: string }[] = [
  { key: 'planner',  label: 'Shutdown Planner' },
  { key: 'pressure', label: 'Pressure 24h' },
  { key: 'flow',     label: 'Flow 24h' },
  { key: 'impact',   label: 'Impact Analysis' },
];

const fmtDt = (s: string) =>
  new Date(s).toLocaleString('en-SG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

const DashboardPanel: React.FC = () => {
  const isDashboardOpen = useShutdownStore(s => s.isDashboardOpen);
  const activeTab = useShutdownStore(s => s.activeTab);
  const analysisResult = useShutdownStore(s => s.analysisResult);
  const toggleDashboard = useShutdownStore(s => s.toggleDashboard);
  const setActiveTab = useShutdownStore(s => s.setActiveTab);

  if (!isDashboardOpen) return null;

  return (
    <div style={{
      flexShrink: 0,
      height: 360,
      borderTop: '2px solid #1565c0',
      background: '#fafafa',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header bar */}
      <div style={{
        height: 36, minHeight: 36, background: '#1565c0', color: '#fff',
        display: 'flex', alignItems: 'center', padding: '0 10px', gap: 6,
        flexShrink: 0, userSelect: 'none',
      }}>
        <button
          onClick={toggleDashboard}
          style={{
            background: 'none', border: 'none', color: '#fff',
            cursor: 'pointer', fontSize: 11, padding: '0 4px', lineHeight: 1,
          }}
          title={isDashboardOpen ? 'Collapse dashboard' : 'Expand dashboard'}
        >
          {isDashboardOpen ? '▼' : '▶'}
        </button>

        <span style={{ fontWeight: 700, fontSize: 12, marginRight: 8 }}>
          Simulation Dashboard
        </span>

        {analysisResult && (
          <span style={{ fontSize: 10, color: '#90caf9', fontStyle: 'italic' }}>
            {analysisResult.pipe_ids.join(', ')} · {analysisResult.affected_node_ids.length} affected nodes
          </span>
        )}

        {/* Tab buttons — right-aligned */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
          {TAB_LABELS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeTab === key ? '2px solid #fff' : '2px solid transparent',
                color: activeTab === key ? '#fff' : 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: activeTab === key ? 600 : 400,
                padding: '2px 10px',
                lineHeight: '30px',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden auto', padding: '10px 14px' }}>
          {activeTab === 'planner' && <ShutdownPlannerForm />}

          {activeTab === 'pressure' && (
            analysisResult ? (
              <div>
                <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>
                  <strong>24-hour pressure comparison</strong> — baseline (blue) vs shutdown (red).
                  Yellow bands = peak demand hours. Orange dashed = 1 bar minimum.
                  Scheduled: {fmtDt(analysisResult.start_datetime)} → {fmtDt(analysisResult.end_datetime)}
                </div>
                <PressureChart
                  baseline={analysisResult.baseline_pressure}
                  shutdown={analysisResult.shutdown_pressure}
                  isolatedCount={analysisResult.node_impacts.filter(n => n.side === 'downstream').length}
                  totalNodes={analysisResult.node_impacts.length}
                />
              </div>
            ) : (
              <div style={{ color: '#9e9e9e', fontSize: 12, padding: '40px 0', textAlign: 'center' }}>
                Run an analysis first using the Shutdown Planner tab.
              </div>
            )
          )}

          {activeTab === 'flow' && (
            analysisResult ? (
              <div>
                <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>
                  <strong>24-hour flow comparison</strong> — dashed = baseline, solid = shutdown.
                  Yellow bands = peak demand hours.
                </div>
                <FlowChart
                  baselineFlow={analysisResult.baseline_flow}
                  shutdownFlow={analysisResult.shutdown_flow}
                  pipeIds={analysisResult.pipe_ids}
                />
              </div>
            ) : (
              <div style={{ color: '#9e9e9e', fontSize: 12, padding: '40px 0', textAlign: 'center' }}>
                Run an analysis first using the Shutdown Planner tab.
              </div>
            )
          )}

          {activeTab === 'impact' && (
            analysisResult ? (
              <ImpactPanel
                nodeImpacts={analysisResult.node_impacts ?? []}
                pipeImpacts={analysisResult.pipe_impacts ?? []}
                pipeIds={analysisResult.pipe_ids}
              />
            ) : (
              <div style={{ color: '#9e9e9e', fontSize: 12, padding: '40px 0', textAlign: 'center' }}>
                Run an analysis first using the Shutdown Planner tab.
              </div>
            )
          )}
        </div>
    </div>
  );
};

export default DashboardPanel;

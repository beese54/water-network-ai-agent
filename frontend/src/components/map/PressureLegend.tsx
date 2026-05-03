import React from 'react';
import { PRESSURE_LEGEND } from '../../utils/pressureColor';
import { VELOCITY_LEGEND } from '../../utils/velocityColor';
import { useShutdownStore } from '../../store/shutdownStore';
import { useSimulationStore } from '../../store/simulationStore';

const PressureLegend: React.FC = () => {
  const analysisResult = useShutdownStore(s => s.analysisResult);
  const simResult = useSimulationStore(s => s.result);
  const isolatedCount = analysisResult
    ? analysisResult.node_impacts.filter(n => n.side === 'downstream').length
    : 0;

  return (
    <div style={{
      position: 'absolute',
      bottom: 32,
      left: 12,
      zIndex: 1000,
      background: 'rgba(255,255,255,0.92)',
      borderRadius: 6,
      padding: '8px 12px',
      boxShadow: '0 1px 5px rgba(0,0,0,0.2)',
      fontSize: 12,
      lineHeight: 1.6,
      pointerEvents: 'none',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Residual Pressure</div>
      {PRESSURE_LEGEND.map(item => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 12, height: 12, borderRadius: '50%',
            background: item.color, flexShrink: 0,
          }} />
          <span>{item.label}</span>
        </div>
      ))}
      {isolatedCount > 0 && (
        <>
          <div style={{ borderTop: '1px solid #e0e0e0', margin: '6px 0 4px' }} />
          <div style={{ fontWeight: 600, marginBottom: 2, color: '#b71c1c' }}>Shutdown Impact</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 12, height: 12, borderRadius: '50%',
              background: '#212121', border: '2px solid #e53935', flexShrink: 0,
              boxSizing: 'border-box',
            }} />
            <span>No supply ({isolatedCount} nodes)</span>
          </div>
        </>
      )}
      {simResult && (
        <>
          <div style={{ borderTop: '1px solid #e0e0e0', margin: '6px 0 4px' }} />
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Pipe Flow Velocity</div>
          {VELOCITY_LEGEND.map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 22, height: 4, borderRadius: 2,
                background: item.color, flexShrink: 0,
              }} />
              <span>{item.label}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
};

export default PressureLegend;

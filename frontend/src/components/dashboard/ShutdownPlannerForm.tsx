import React from 'react';
import { useShutdownStore } from '../../store/shutdownStore';

const label: React.CSSProperties = { fontSize: 11, color: '#555', display: 'block', marginBottom: 3 };
const input: React.CSSProperties = {
  width: '100%', height: 32, border: '1px solid #ccc', borderRadius: 4,
  padding: '0 8px', fontSize: 12, boxSizing: 'border-box', fontFamily: 'inherit',
};

const ShutdownPlannerForm: React.FC = () => {
  const form = useShutdownStore(s => s.form);
  const isAnalysing = useShutdownStore(s => s.isAnalysing);
  const analysisError = useShutdownStore(s => s.analysisError);
  const analysisResult = useShutdownStore(s => s.analysisResult);
  const updateForm = useShutdownStore(s => s.updateForm);
  const runAnalysis = useShutdownStore(s => s.runAnalysis);
  const clearAnalysis = useShutdownStore(s => s.clearAnalysis);
  const selectedPipeIds = useShutdownStore(s => s.selectedPipeIds);
  const clearPipeSelection = useShutdownStore(s => s.clearPipeSelection);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 480 }}>
      <div>
        <label style={label}>
          Pipe ID(s) to shut down{' '}
          <span style={{ color: '#9e9e9e' }}>(comma-separated, or click pipes on map)</span>
        </label>
        {selectedPipeIds.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
            padding: '4px 8px', background: '#fff3e0', borderRadius: 4,
            border: '1px solid #ff6d00', fontSize: 11,
          }}>
            <span style={{ color: '#e65100', fontWeight: 600 }}>
              {selectedPipeIds.length} pipe{selectedPipeIds.length !== 1 ? 's' : ''} selected on map
            </span>
            <button
              onClick={clearPipeSelection}
              style={{ background: 'none', border: 'none', color: '#9e9e9e', fontSize: 11, cursor: 'pointer', padding: 0, marginLeft: 'auto' }}
            >
              Clear
            </button>
          </div>
        )}
        <input
          style={input}
          type="text"
          placeholder="T0001, D0034"
          value={form.pipeIds}
          onChange={e => updateForm({ pipeIds: e.target.value })}
          disabled={isAnalysing}
        />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={label}>Shutdown start date &amp; time</label>
          <input
            style={input}
            type="datetime-local"
            value={form.startDatetime}
            onChange={e => updateForm({ startDatetime: e.target.value })}
            disabled={isAnalysing}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={label}>Shutdown end date &amp; time</label>
          <input
            style={input}
            type="datetime-local"
            value={form.endDatetime}
            onChange={e => updateForm({ endDatetime: e.target.value })}
            disabled={isAnalysing}
          />
        </div>
      </div>

      <button
        onClick={runAnalysis}
        disabled={isAnalysing}
        style={{
          background: isAnalysing ? '#546e7a' : '#1976d2',
          color: '#fff', border: 'none', borderRadius: 4,
          height: 36, cursor: isAnalysing ? 'not-allowed' : 'pointer',
          fontSize: 12, fontWeight: 600, marginTop: 2,
        }}
      >
        {isAnalysing ? 'Running analysis...' : 'Run Shutdown Analysis'}
      </button>

      {analysisError && (
        <div style={{ fontSize: 11, color: '#e53935', padding: '4px 0' }}>{analysisError}</div>
      )}

      {analysisResult && !analysisError && (
        <div style={{ fontSize: 11, color: '#2e7d32', padding: '4px 6px', background: '#e8f5e9', borderRadius: 4 }}>
          {analysisResult.summary_text}
          {' '}
          <button
            onClick={clearAnalysis}
            style={{ background: 'none', border: 'none', color: '#9e9e9e', fontSize: 11, cursor: 'pointer', padding: 0 }}
          >
            Clear
          </button>
        </div>
      )}

      <div style={{ fontSize: 10, color: '#9e9e9e', lineHeight: 1.4 }}>
        Runs a full 24-hour hydraulic comparison: baseline (all pipes open) vs. shutdown scenario.
        Switch to the Pressure or Flow tabs to view results.
      </div>
    </div>
  );
};

export default ShutdownPlannerForm;

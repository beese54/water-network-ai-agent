import React from 'react';
import { useNetworkStore } from '../../store/networkStore';
import { useSimulationStore } from '../../store/simulationStore';
import { useShutdownStore } from '../../store/shutdownStore';
import { useEditStore } from '../../store/editStore';
import NetworkMap from '../map/NetworkMap';
import ChatPanel from '../chat/ChatPanel';
import ResultsPanel from '../results/ResultsPanel';
import DashboardPanel from '../dashboard/DashboardPanel';
const AppShell: React.FC = () => {
  const isLoading = useNetworkStore(s => s.isLoading);
  const resetNetwork = useNetworkStore(s => s.reset);
  const clearResults = useSimulationStore(s => s.clearResults);
  const runSimulation = useSimulationStore(s => s.runSimulation);
  const isRunning = useSimulationStore(s => s.isRunning);
  const result = useSimulationStore(s => s.result);
  const openDashboard = useShutdownStore(s => s.openDashboard);
  const clearAnalysis = useShutdownStore(s => s.clearAnalysis);
  const selectionMode = useShutdownStore(s => s.selectionMode);
  const selectedPipeIds = useShutdownStore(s => s.selectedPipeIds);
  const toggleSelectionMode = useShutdownStore(s => s.toggleSelectionMode);
  const isEditMode = useEditStore(s => s.isEditMode);
  const toggleEditMode = useEditStore(s => s.toggleEditMode);

  const handlePipeClick = (pipeId: string) => {
    // Pre-populate chat input with pipe shutdown suggestion
    // We dispatch a custom event that ChatInput can listen to
    const event = new CustomEvent('pipe-clicked', { detail: pipeId });
    window.dispatchEvent(event);
  };

  const handleReset = async () => {
    await resetNetwork();
    clearResults();
    clearAnalysis();
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Top bar */}
      <div style={{
        background: '#0d47a1', color: '#fff',
        padding: '8px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)', zIndex: 1100,
        flexShrink: 0,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            Bukit Batok Water Distribution — Hydraulic Simulation
          </div>
          <div style={{ fontSize: 11, color: '#bbdefb' }}>
            Reservoir: 45m head · Min pressure: 1 bar (10.197m) · 120 nodes · 202 pipes
          </div>
        </div>

        <button
          onClick={toggleSelectionMode}
          title={selectionMode ? 'Click pipes on map to select/deselect' : 'Enable pipe selection mode'}
          style={{
            background: selectionMode ? '#ff6d00' : 'rgba(255,255,255,0.15)',
            color: '#fff',
            border: selectionMode ? '1px solid #ff6d00' : '1px solid rgba(255,255,255,0.3)',
            borderRadius: 5,
            padding: '6px 14px', cursor: 'pointer', fontSize: 12,
            fontWeight: selectionMode ? 700 : 400,
          }}
        >
          {selectionMode
            ? `Selecting Pipes${selectedPipeIds.length > 0 ? ` (${selectedPipeIds.length})` : ''}`
            : 'Select Pipes'}
        </button>

        <button
          onClick={() => { openDashboard(); useShutdownStore.getState().setActiveTab('planner'); }}
          style={{
            background: 'rgba(255,255,255,0.15)', color: '#fff',
            border: '1px solid rgba(255,255,255,0.3)', borderRadius: 5,
            padding: '6px 14px', cursor: 'pointer', fontSize: 12,
          }}
        >
          Shutdown Analysis
        </button>

        <button
          onClick={runSimulation}
          disabled={isRunning}
          style={{
            background: isRunning ? '#546e7a' : '#1976d2',
            color: '#fff', border: 'none', borderRadius: 5,
            padding: '6px 14px', cursor: isRunning ? 'not-allowed' : 'pointer',
            fontSize: 12, fontWeight: 600,
          }}
        >
          {isRunning ? 'Running...' : 'Run Simulation'}
        </button>

        <button
          onClick={handleReset}
          style={{
            background: 'rgba(255,255,255,0.15)', color: '#fff',
            border: '1px solid rgba(255,255,255,0.3)', borderRadius: 5,
            padding: '6px 14px', cursor: 'pointer', fontSize: 12,
          }}
        >
          Reset Network
        </button>

        <button
          onClick={toggleEditMode}
          style={{
            background: isEditMode ? '#e53935' : 'rgba(255,255,255,0.15)',
            color: '#fff',
            border: isEditMode ? '1px solid #e53935' : '1px solid rgba(255,255,255,0.3)',
            borderRadius: 5,
            padding: '6px 14px', cursor: 'pointer', fontSize: 12,
            fontWeight: isEditMode ? 700 : 400,
          }}
        >
          {isEditMode ? 'Done Editing' : '✏ Edit Network'}
        </button>
      </div>

      {/* Footnote strip */}
      <div style={{
        background: '#1a237e', color: 'rgba(255,255,255,0.55)',
        padding: '3px 16px', fontSize: 10, display: 'flex', gap: 24, flexShrink: 0,
      }}>
        <span><strong style={{ color: 'rgba(255,255,255,0.75)' }}>Select Pipes:</strong> Click pipes on the map to add them to the shutdown selection.</span>
        <span><strong style={{ color: 'rgba(255,255,255,0.75)' }}>Shutdown Analysis:</strong> Simulate a 24-hour pressure &amp; flow comparison with selected pipes closed.</span>
        <span><strong style={{ color: 'rgba(255,255,255,0.75)' }}>Run Simulation:</strong> Run a baseline hydraulic snapshot of the current network state.</span>
        <span><strong style={{ color: 'rgba(255,255,255,0.75)' }}>Reset Network:</strong> Reopen all closed pipes and clear simulation results.</span>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Map + Results */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* Map */}
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            {isLoading && (
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)',
                zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, color: '#555',
              }}>
                Loading network topology...
              </div>
            )}
            {isRunning && (
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.5)',
                zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, color: '#1565c0',
              }}>
                Running hydraulic simulation...
              </div>
            )}
            <NetworkMap onPipeClick={handlePipeClick} />
          </div>

          {/* Results panel — only when simulation data exists */}
          {result && (
            <div style={{ borderTop: '2px solid #e0e0e0', flexShrink: 0, background: '#fff' }}>
              <ResultsPanel />
            </div>
          )}

          {/* Shutdown analysis dashboard — always present, collapsible */}
          <DashboardPanel />
        </div>

        {/* Right: Chat */}
        <div style={{ width: 360, flexShrink: 0, overflow: 'hidden' }}>
          <ChatPanel />
        </div>
      </div>
    </div>
  );
};

export default AppShell;

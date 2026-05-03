import React, { useEffect } from 'react';
import { useEditStore, type EditTool } from '../../store/editStore';

const btn = (
  label: string,
  active: boolean,
  onClick: () => void,
  title?: string,
): React.ReactElement => (
  <button
    key={label}
    title={title ?? label}
    onClick={onClick}
    style={{
      padding: '5px 10px',
      fontSize: 12,
      fontWeight: 600,
      cursor: 'pointer',
      border: `2px solid ${active ? '#1565c0' : '#90a4ae'}`,
      borderRadius: 4,
      background: active ? '#1565c0' : 'white',
      color: active ? 'white' : '#37474f',
      transition: 'all 0.15s',
      whiteSpace: 'nowrap',
    }}
  >
    {label}
  </button>
);

const EditModeToolbar: React.FC = () => {
  const {
    isEditMode,
    activeTool,
    pipeSourceNodeId,
    defaultDiameterMm,
    defaultCategory,
    isSaving,
    lastError,
    setActiveTool,
    setDefaultDiameterMm,
    setDefaultCategory,
    setError,
  } = useEditStore();

  // Auto-dismiss error after 4 seconds
  useEffect(() => {
    if (!lastError) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [lastError, setError]);

  const tools: { id: EditTool; label: string; title: string }[] = [
    { id: 'select', label: '↖ Select / Move', title: 'Select and drag nodes' },
    { id: 'addNode', label: '+ Node', title: 'Click empty map to add a junction' },
    { id: 'addPipe', label: '~ Pipe', title: 'Click two nodes to draw a pipe' },
    { id: 'delete', label: '✕ Delete', title: 'Click a node or pipe to delete it' },
    { id: 'pipeStatus', label: '⬤ Open/Close', title: 'Click a pipe to toggle its open/closed status' },
  ];

  const pipeStatus =
    activeTool === 'addPipe'
      ? pipeSourceNodeId
        ? `${pipeSourceNodeId} → click node or pipe · Esc to stop`
        : 'Click a node or pipe to start…'
      : null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        alignItems: 'flex-end',
        pointerEvents: 'none',
      }}
    >
      {/* Tool palette — only when edit mode is active */}
      {isEditMode && (
        <div
          style={{
            pointerEvents: 'all',
            background: 'rgba(255,255,255,0.97)',
            borderRadius: 6,
            padding: '8px 10px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            minWidth: 220,
          }}
        >
          {/* Tool buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {tools.map((t) => btn(t.label, activeTool === t.id, () => setActiveTool(t.id), t.title))}
          </div>

          {/* Open/Close status hint */}
          {activeTool === 'pipeStatus' && (
            <div style={{ fontSize: 11, color: '#1565c0', fontStyle: 'italic' }}>
              Click a pipe to toggle its open/closed status
            </div>
          )}

          {/* Add Pipe options */}
          {activeTool === 'addPipe' && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontSize: 11, color: '#546e7a' }}>Diameter</label>
              <input
                type="number"
                min={25}
                max={2000}
                value={defaultDiameterMm}
                onChange={(e) => setDefaultDiameterMm(Number(e.target.value))}
                style={{ width: 60, fontSize: 12, padding: '2px 4px', border: '1px solid #ccc', borderRadius: 3 }}
              />
              <label style={{ fontSize: 11, color: '#546e7a' }}>mm</label>
              <select
                value={defaultCategory}
                onChange={(e) => setDefaultCategory(e.target.value as 'service' | 'distribution' | 'trunk')}
                style={{ fontSize: 12, padding: '2px 4px', border: '1px solid #ccc', borderRadius: 3 }}
              >
                <option value="service">Service (100 mm)</option>
                <option value="distribution">Distribution (300 mm)</option>
                <option value="trunk">Trunk (1000 mm)</option>
              </select>
            </div>
          )}

          {/* Pipe drawing status */}
          {pipeStatus && (
            <div style={{ fontSize: 11, color: '#1565c0', fontStyle: 'italic' }}>
              {pipeStatus}
            </div>
          )}

          {/* Saving indicator */}
          {isSaving && (
            <div style={{ fontSize: 11, color: '#757575' }}>Saving…</div>
          )}

          {/* Error toast */}
          {lastError && (
            <div
              style={{
                fontSize: 11,
                color: 'white',
                background: '#e53935',
                borderRadius: 4,
                padding: '4px 8px',
              }}
            >
              {lastError}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EditModeToolbar;

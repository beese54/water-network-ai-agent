import React from 'react';
import { Polyline, Tooltip } from 'react-leaflet';
import type { NetworkPipe } from '../../types/network';
import type { PipeResult } from '../../types/simulation';
import { useNetworkStore } from '../../store/networkStore';
import { useShutdownStore } from '../../store/shutdownStore';
import { useEditStore, type EditTool } from '../../store/editStore';
import { setPipeStatus } from '../../services/networkEditService';
import { velocityToColor } from '../../utils/velocityColor';

interface Props {
  pipes: NetworkPipe[];
  closedPipes: Set<string>;
  pipeResultMap?: Record<string, PipeResult>;
  onPipeClick?: (pipe: NetworkPipe, latlng: { lat: number; lng: number }) => void;
  editMode?: boolean;
  activeTool?: EditTool;
}

const CATEGORY_COLOR: Record<string, string> = {
  trunk: '#1565c0',
  distribution: '#1976d2',
  service: '#90a4ae',
  valve: '#7b1fa2',
};

const hasSimResults = (pipeResultMap?: Record<string, PipeResult>) =>
  !!pipeResultMap && Object.keys(pipeResultMap).length > 0;

const PipeLayer: React.FC<Props> = ({ pipes, closedPipes, pipeResultMap, onPipeClick, editMode = false, activeTool = 'select' }) => {
  const topology = useNetworkStore(s => s.topology);
  const updatePipeStatus = useNetworkStore(s => s.updatePipeStatus);
  const selectionMode = useShutdownStore(s => s.selectionMode);
  const selectedPipeIds = useShutdownStore(s => s.selectedPipeIds);
  const togglePipeSelection = useShutdownStore(s => s.togglePipeSelection);
  const setSaving = useEditStore(s => s.setSaving);
  const setError = useEditStore(s => s.setError);

  const nodePos = React.useMemo(() => {
    const map: Record<string, [number, number]> = {};
    if (!topology) return map;
    topology.nodes.forEach(n => { map[n.id] = [n.lat, n.lon]; });
    map['R001'] = [topology.reservoir.lat, topology.reservoir.lon];
    return map;
  }, [topology]);

  if (!topology) return null;

  return (
    <>
      {pipes.map(pipe => {
        const start = nodePos[pipe.start_node];
        const end = nodePos[pipe.end_node];
        if (!start || !end) return null;

        const isClosed = closedPipes.has(pipe.id);
        const isSelected = selectedPipeIds.includes(pipe.id);
        const pipeResult = pipeResultMap?.[pipe.id];
        const simActive = hasSimResults(pipeResultMap);
        const isZeroFlow = !!pipeResult && !isClosed && Math.abs(pipeResult.flow_lps) < 0.001;
        const isDeleteMode = editMode && activeTool === 'delete';

        // Priority: delete-mode → selected → closed → velocity (if sim ran) → category
        const baseColor = isDeleteMode
          ? '#ef5350'
          : isSelected
            ? '#ff6d00'
            : isClosed
              ? '#e53935'
              : simActive && pipeResult
                ? velocityToColor(pipeResult.velocity_mps)
                : simActive && !pipeResult
                  ? '#90a4ae'   // pipe not in results — treat as stagnant
                  : (CATEGORY_COLOR[pipe.category] ?? '#78909c');

        const baseWeight = pipe.category === 'trunk' ? 4 : pipe.category === 'distribution' ? 2.5 : 1.5;
        const weight = isSelected ? baseWeight + 2 : isDeleteMode ? baseWeight + 3 : baseWeight;

        return (
          <Polyline
            key={pipe.id}
            positions={[start, end]}
            pathOptions={{
              color: baseColor,
              weight,
              dashArray: isClosed ? '6 4' : undefined,
              opacity: isDeleteMode ? 0.7 : isSelected ? 1 : isClosed ? 0.9 : 0.75,
            }}
            eventHandlers={{
              click: async (e) => {
                e.originalEvent.stopPropagation();
                if (editMode && activeTool === 'pipeStatus') {
                  const newStatus = isClosed ? 'open' : 'closed';
                  setSaving(true);
                  try {
                    await setPipeStatus(pipe.id, newStatus);
                    updatePipeStatus(pipe.id, newStatus);
                  } catch {
                    setError(`Failed to ${newStatus === 'closed' ? 'close' : 'open'} pipe ${pipe.id}`);
                  } finally {
                    setSaving(false);
                  }
                  return;
                }
                if (selectionMode) togglePipeSelection(pipe.id);
                onPipeClick?.(pipe, { lat: e.latlng.lat, lng: e.latlng.lng });
              },
            }}
          >
            <Tooltip sticky>
              <strong>{pipe.id}</strong>
              <br />
              {pipe.category} · DN{pipe.diameter_mm}
              <br />
              {pipe.length_m.toFixed(0)}m · {isClosed ? 'CLOSED' : 'Open'}
              {pipeResult && (
                <>
                  <br />
                  Flow: {Math.abs(pipeResult.flow_lps).toFixed(2)} L/s · {Math.abs(pipeResult.velocity_mps).toFixed(2)} m/s
                  {isZeroFlow && <><br />⚠ No flow detected</>}
                </>
              )}
            </Tooltip>
          </Polyline>
        );
      })}
    </>
  );
};

export default PipeLayer;

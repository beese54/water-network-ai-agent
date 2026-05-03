import React from 'react';
import { MapContainer, TileLayer, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNetworkStore } from '../../store/networkStore';
import { useSimulationStore } from '../../store/simulationStore';
import PipeLayer from './PipeLayer';
import NodeLayer from './NodeLayer';
import ReservoirMarker from './ReservoirMarker';
import PressureLegend from './PressureLegend';
import MapInfoPanel, { type MapSelection } from './MapInfoPanel';
import SelectionHighlight from './SelectionHighlight';
import FlowArrowLayer from './FlowArrowLayer';
import EditModeToolbar from './EditModeToolbar';
import EditPipePreview from './EditPipePreview';
import { useShutdownStore } from '../../store/shutdownStore';
import { useEditStore } from '../../store/editStore';
import NodeConnectivityPopup from './NodeConnectivityPopup';
import type { NetworkNode, NetworkPipe } from '../../types/network';
import type { NodeImpact, PipeResult } from '../../types/simulation';
import * as editSvc from '../../services/networkEditService';

interface Props {
  onPipeClick?: (pipeId: string) => void;
}

const RESERVOIR = { lat: 1.354710, lon: 103.748655 };

const MapRefSetter: React.FC<{ mapRef: React.MutableRefObject<L.Map | null> }> = ({ mapRef }) => {
  const map = useMap();
  React.useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
};

// Handles empty-map clicks: deselect in normal mode, add node in edit mode
const MapClickHandler: React.FC<{
  justSelectedRef: React.MutableRefObject<boolean>;
  onEmptyClick: () => void;
}> = ({ justSelectedRef, onEmptyClick }) => {
  const isEditMode = useEditStore((s) => s.isEditMode);
  const activeTool = useEditStore((s) => s.activeTool);
  const setSaving = useEditStore((s) => s.setSaving);
  const setError = useEditStore((s) => s.setError);
  const fetchTopology = useNetworkStore((s) => s.fetchTopology);

  useMapEvents({
    async click(e) {
      if (justSelectedRef.current) {
        justSelectedRef.current = false;
        return;
      }
      if (isEditMode && activeTool === 'addNode') {
        setSaving(true);
        try {
          await editSvc.addNode(e.latlng.lat, e.latlng.lng, 0.0);
          await fetchTopology();
        } catch {
          setError('Failed to add node');
        } finally {
          setSaving(false);
        }
        return;
      }
      onEmptyClick();
    },
  });
  return null;
};

const NetworkMap: React.FC<Props> = ({ onPipeClick }) => {
  const topology = useNetworkStore((s) => s.topology);
  const closedPipes = useNetworkStore((s) => s.closedPipes);
  const fetchTopology = useNetworkStore((s) => s.fetchTopology);
  const simResult = useSimulationStore((s) => s.result);
  const focusedNodeId = useSimulationStore((s) => s.focusedNodeId);
  const analysisResult = useShutdownStore((s) => s.analysisResult);
  const selectionMode = useShutdownStore((s) => s.selectionMode);

  const isEditMode = useEditStore((s) => s.isEditMode);
  const activeTool = useEditStore((s) => s.activeTool);
  const pipeSourceNodeId = useEditStore((s) => s.pipeSourceNodeId);
  const defaultDiameterMm = useEditStore((s) => s.defaultDiameterMm);
  const defaultCategory = useEditStore((s) => s.defaultCategory);
  const setPipeSourceNode = useEditStore((s) => s.setPipeSourceNode);
  const setSaving = useEditStore((s) => s.setSaving);
  const setError = useEditStore((s) => s.setError);

  const [selection, setSelection] = React.useState<MapSelection | null>(null);
  const [showFlowArrows, setShowFlowArrows] = React.useState(false);
  const justSelectedRef = React.useRef(false);
  const mapRef = React.useRef<L.Map | null>(null);

  // Auto-zoom to affected nodes when shutdown analysis completes
  React.useEffect(() => {
    if (!analysisResult || !mapRef.current) return;
    const [minLat, minLon, maxLat, maxLon] = analysisResult.affected_bbox;
    mapRef.current.fitBounds([[minLat, minLon], [maxLat, maxLon]], { padding: [40, 40], maxZoom: 16, animate: true });
  }, [analysisResult]);

  // Fly to node focused from results panel or impact panel
  React.useEffect(() => {
    if (!focusedNodeId || !mapRef.current || !topology) return;
    const node = topology.nodes.find((n) => n.id === focusedNodeId);
    if (!node) return;
    mapRef.current.flyTo([node.lat, node.lon], 17, { animate: true, duration: 0.8 } as any);
    setSelection({ type: 'node', node, result: nodeResultMap[node.id] });
  }, [focusedNodeId, topology]); // nodeResultMap intentionally omitted to avoid stale-closure re-trigger

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelection(null);
        setPipeSourceNode(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPipeSourceNode]);

  const pressureMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    simResult?.node_results.forEach((nr) => { map[nr.node_id] = nr.pressure_bar; });
    return map;
  }, [simResult]);

  const nodeResultMap = React.useMemo(() => {
    const map: Record<string, import('../../types/simulation').NodeResult> = {};
    simResult?.node_results.forEach((nr) => { map[nr.node_id] = nr; });
    return map;
  }, [simResult]);

  const pipeResultMap = React.useMemo(() => {
    const map: Record<string, PipeResult> = {};
    simResult?.pipe_results.forEach((pr) => { map[pr.pipe_id] = pr; });
    return map;
  }, [simResult]);

  const nodeElevMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    topology?.nodes.forEach((n) => { map[n.id] = n.elevation_m; });
    return map;
  }, [topology]);

  const nodeImpactMap = React.useMemo(() => {
    const map: Record<string, NodeImpact> = {};
    analysisResult?.node_impacts.forEach((ni) => { map[ni.node_id] = ni; });
    return map;
  }, [analysisResult]);

  const handleNodeClick = React.useCallback(async (node: NetworkNode) => {
    justSelectedRef.current = true;

    if (!isEditMode) {
      setSelection({ type: 'node', node, result: nodeResultMap[node.id] });
      return;
    }

    if (activeTool === 'select') {
      setSelection({ type: 'node', node, result: nodeResultMap[node.id] });
      return;
    }

    if (activeTool === 'addPipe') {
      if (pipeSourceNodeId === null) {
        setPipeSourceNode(node.id);
      } else if (pipeSourceNodeId !== node.id) {
        setSaving(true);
        try {
          await editSvc.addPipe(pipeSourceNodeId, node.id, defaultDiameterMm, defaultCategory);
          // Keep destination as new source for chain drawing; Escape to stop
          setPipeSourceNode(node.id);
          await fetchTopology();
        } catch {
          setError('Failed to add pipe');
          setPipeSourceNode(null);
        } finally {
          setSaving(false);
        }
      }
      return;
    }

    if (activeTool === 'delete') {
      setSaving(true);
      try {
        await editSvc.deleteNode(node.id);
        setSelection(null);
        await fetchTopology();
      } catch {
        setError('Failed to delete node');
      } finally {
        setSaving(false);
      }
    }
  }, [
    isEditMode, activeTool, pipeSourceNodeId,
    defaultDiameterMm, defaultCategory,
    nodeResultMap, setPipeSourceNode, setSaving, setError, fetchTopology,
  ]);

  const handlePipeClick = React.useCallback(async (pipe: NetworkPipe, latlng: { lat: number; lng: number }) => {
    justSelectedRef.current = true;

    if (!isEditMode) {
      if (!selectionMode) onPipeClick?.(pipe.id);
      setSelection({ type: 'pipe', pipe, result: pipeResultMap[pipe.id] });
      return;
    }

    if (activeTool === 'select') {
      setSelection({ type: 'pipe', pipe, result: pipeResultMap[pipe.id] });
      return;
    }

    if (activeTool === 'addPipe') {
      // Split pipe at click point, optionally connecting from current source
      setSaving(true);
      try {
        const split = await editSvc.splitPipe(pipe.id, latlng.lat, latlng.lng);
        if (pipeSourceNodeId !== null) {
          await editSvc.addPipe(pipeSourceNodeId, split.new_node_id, defaultDiameterMm, defaultCategory);
        }
        // New junction becomes the source for chain drawing
        setPipeSourceNode(split.new_node_id);
        await fetchTopology();
      } catch {
        setError('Failed to split pipe');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (activeTool === 'delete') {
      setSaving(true);
      try {
        await editSvc.deletePipe(pipe.id);
        setSelection(null);
        await fetchTopology();
      } catch {
        setError('Failed to delete pipe');
      } finally {
        setSaving(false);
      }
    }
  }, [
    isEditMode, activeTool, selectionMode, pipeSourceNodeId,
    defaultDiameterMm, defaultCategory,
    pipeResultMap, onPipeClick, setPipeSourceNode, setSaving, setError, fetchTopology,
  ]);

  const handleNodeDragEnd = React.useCallback(async (nodeId: string, lat: number, lng: number) => {
    const node = topology?.nodes.find((n) => n.id === nodeId);
    const elevationM = node?.elevation_m ?? 0;
    setSaving(true);
    try {
      await editSvc.moveNode(nodeId, lat, lng, elevationM);
      await fetchTopology();
    } catch {
      setError('Failed to move node');
    } finally {
      setSaving(false);
    }
  }, [topology, setSaving, setError, fetchTopology]);

  // Map cursor based on active edit tool
  const cursorStyle = isEditMode
    ? { select: 'default', addNode: 'crosshair', addPipe: 'cell', delete: 'pointer' }[activeTool] ?? 'default'
    : 'default';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', cursor: cursorStyle }}>
      <MapContainer
        center={[RESERVOIR.lat, RESERVOIR.lon]}
        zoom={14}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          maxZoom={19}
        />

        <MapRefSetter mapRef={mapRef} />
        <MapClickHandler justSelectedRef={justSelectedRef} onEmptyClick={() => setSelection(null)} />
        <EditPipePreview />

        {topology && (
          <>
            <PipeLayer
              pipes={topology.pipes}
              closedPipes={closedPipes}
              pipeResultMap={pipeResultMap}
              onPipeClick={handlePipeClick}
              editMode={isEditMode}
              activeTool={activeTool}
            />
            <NodeLayer
              nodes={topology.nodes}
              pressureMap={pressureMap}
              onNodeClick={handleNodeClick}
              nodeImpactMap={analysisResult ? nodeImpactMap : undefined}
              editMode={isEditMode}
              activeTool={activeTool}
              onNodeDragEnd={handleNodeDragEnd}
            />
            <SelectionHighlight selection={selection} />
            <ReservoirMarker reservoir={topology.reservoir} />
            {showFlowArrows && Object.keys(pipeResultMap).length > 0 && (
              <FlowArrowLayer pipes={topology.pipes} pipeResultMap={pipeResultMap} />
            )}
          </>
        )}
      </MapContainer>

      {simResult && (
        <button
          onClick={() => setShowFlowArrows((v) => !v)}
          title="Toggle flow direction arrows"
          style={{
            position: 'absolute',
            top: 80,
            right: 10,
            zIndex: 1000,
            background: showFlowArrows ? '#1565c0' : 'white',
            color: showFlowArrows ? 'white' : '#1565c0',
            border: '2px solid #1565c0',
            borderRadius: 4,
            padding: '4px 8px',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            boxShadow: '0 1px 5px rgba(0,0,0,0.2)',
            lineHeight: 1.4,
          }}
        >
          &#8594; Flow
        </button>
      )}

      <NodeConnectivityPopup nodeResultMap={nodeResultMap} />
      <EditModeToolbar />
      <PressureLegend />
      <MapInfoPanel
        selection={selection}
        onClose={() => setSelection(null)}
        nodeElevMap={nodeElevMap}
        reservoirHead={topology?.reservoir.head_m ?? 145}
      />
    </div>
  );
};

export default NetworkMap;

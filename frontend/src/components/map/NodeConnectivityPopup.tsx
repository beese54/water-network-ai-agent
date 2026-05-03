import React from 'react';
import { useSimulationStore } from '../../store/simulationStore';
import { useNetworkStore } from '../../store/networkStore';
import { pressureToColor } from '../../utils/pressureColor';
import type { NodeResult } from '../../types/simulation';

interface Props {
  nodeResultMap: Record<string, NodeResult>;
}

const CATEGORY_LABEL: Record<string, string> = {
  trunk: 'trunk',
  distribution: 'dist',
  service: 'svc',
  valve: 'valve',
};

const NodeConnectivityPopup: React.FC<Props> = ({ nodeResultMap }) => {
  const focusedNodeId = useSimulationStore((s) => s.focusedNodeId);
  const setFocusedNode = useSimulationStore((s) => s.setFocusedNode);
  const topology = useNetworkStore((s) => s.topology);

  if (!focusedNodeId || !topology) return null;

  const node = topology.nodes.find((n) => n.id === focusedNodeId);
  if (!node) return null;

  const pipeMap = Object.fromEntries(topology.pipes.map((p) => [p.id, p]));
  const zoneLabel = node.zone?.replace(/_/g, ' ') ?? 'Unknown zone';
  const result = nodeResultMap[focusedNodeId];

  const upstreamFeeds = node.upstream_pipe_ids.map((pipeId) => {
    const pipe = pipeMap[pipeId];
    return { pipeId, pipe, sourceNodeId: pipe?.upstream_node_id };
  });

  const downstreamFeeds = node.downstream_pipe_ids.map((pipeId) => {
    const pipe = pipeMap[pipeId];
    return { pipeId, pipe, destNodeId: pipe?.downstream_node_id };
  });

  const NodeLink: React.FC<{ nodeId: string }> = ({ nodeId }) => (
    <button
      onClick={() => setFocusedNode(nodeId)}
      style={{
        background: 'none',
        border: '1px solid #90caf9',
        borderRadius: 3,
        padding: '1px 5px',
        cursor: 'pointer',
        fontFamily: 'monospace',
        fontSize: 11,
        color: '#1565c0',
        fontWeight: 600,
      }}
      title={`Focus ${nodeId} on map`}
    >
      {nodeId}
    </button>
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 1000,
        background: 'white',
        borderRadius: 6,
        boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
        minWidth: 260,
        maxWidth: 320,
        maxHeight: 480,
        display: 'flex',
        flexDirection: 'column',
        fontSize: 12,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        background: '#1565c0',
        color: 'white',
        padding: '8px 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 6,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>&#x1F4CD;</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>{focusedNodeId}</span>
        </div>
        <button
          onClick={() => setFocusedNode(null)}
          style={{
            background: 'none', border: 'none', color: 'white',
            cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0,
          }}
          title="Close"
        >
          &#x2715;
        </button>
      </div>

      {/* Node meta */}
      <div style={{ padding: '6px 10px', borderBottom: '1px solid #e0e0e0', color: '#424242' }}>
        <div>{zoneLabel}</div>
        <div style={{ display: 'flex', gap: 12, marginTop: 2, color: '#757575' }}>
          <span>Elev: {node.elevation_m.toFixed(1)} m</span>
          <span>Depth: {node.depth_from_reservoir >= 0 ? node.depth_from_reservoir : '—'} hops</span>
        </div>
        {result && (
          <div style={{ marginTop: 2, fontWeight: 600, color: pressureToColor(result.pressure_bar) }}>
            Pressure: {result.pressure_bar.toFixed(2)} bar
          </div>
        )}
      </div>

      {/* Scrollable body */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {/* Upstream feeds */}
        <div style={{ padding: '6px 10px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: '#1565c0', textTransform: 'uppercase',
            letterSpacing: 0.5, marginBottom: 5,
          }}>
            &#x25B2; Upstream feeds ({upstreamFeeds.length})
          </div>
          {upstreamFeeds.length === 0 && (
            <div style={{ color: '#9e9e9e', fontSize: 11 }}>No upstream pipes (source node)</div>
          )}
          {upstreamFeeds.map(({ pipeId, pipe, sourceNodeId }) => (
            <div key={pipeId} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              marginBottom: 4, flexWrap: 'wrap',
            }}>
              {sourceNodeId ? <NodeLink nodeId={sourceNodeId} /> : <span style={{ color: '#9e9e9e', fontSize: 11 }}>?</span>}
              <span style={{ color: '#90a4ae', fontSize: 10 }}>
                &#x2500;{pipeId}
                {pipe ? ` (${CATEGORY_LABEL[pipe.category] ?? pipe.category})` : ''}
                &#x2500;&#x25B6;
              </span>
              <span style={{ fontSize: 11, color: '#546e7a' }}>&#x25CF;</span>
            </div>
          ))}
        </div>

        {/* Downstream feeds */}
        <div style={{ padding: '6px 10px' }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: '#2e7d32', textTransform: 'uppercase',
            letterSpacing: 0.5, marginBottom: 5,
          }}>
            &#x25BC; Downstream feeds ({downstreamFeeds.length})
          </div>
          {downstreamFeeds.length === 0 && (
            <div style={{ color: '#9e9e9e', fontSize: 11 }}>No downstream pipes (leaf node)</div>
          )}
          {downstreamFeeds.map(({ pipeId, pipe, destNodeId }) => (
            <div key={pipeId} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              marginBottom: 4, flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 11, color: '#546e7a' }}>&#x25CF;</span>
              <span style={{ color: '#90a4ae', fontSize: 10 }}>
                &#x2500;{pipeId}
                {pipe ? ` (${CATEGORY_LABEL[pipe.category] ?? pipe.category})` : ''}
                &#x2500;&#x25B6;
              </span>
              {destNodeId ? <NodeLink nodeId={destNodeId} /> : <span style={{ color: '#9e9e9e', fontSize: 11 }}>?</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NodeConnectivityPopup;

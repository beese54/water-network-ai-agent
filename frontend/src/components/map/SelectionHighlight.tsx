import React from 'react';
import { CircleMarker, Polyline } from 'react-leaflet';
import type { MapSelection } from './MapInfoPanel';
import { useNetworkStore } from '../../store/networkStore';

interface Props {
  selection: MapSelection | null;
}

const SELECTED_COLOR = '#e53935';

const SelectionHighlight: React.FC<Props> = ({ selection }) => {
  const topology = useNetworkStore(s => s.topology);

  if (!selection || !topology) return null;

  if (selection.type === 'node') {
    const { node } = selection;
    return (
      <CircleMarker
        key={`highlight-${node.id}`}
        center={[node.lat, node.lon]}
        radius={10}
        pathOptions={{
          fillColor: SELECTED_COLOR,
          color: '#b71c1c',
          weight: 2,
          fillOpacity: 0.9,
          interactive: false,
        }}
      />
    );
  }

  const { pipe } = selection;
  const nodePos: Record<string, [number, number]> = {};
  topology.nodes.forEach(n => { nodePos[n.id] = [n.lat, n.lon]; });
  nodePos['R001'] = [topology.reservoir.lat, topology.reservoir.lon];

  const start = nodePos[pipe.start_node];
  const end = nodePos[pipe.end_node];
  if (!start || !end) return null;

  const baseWeight = pipe.category === 'trunk' ? 4 : pipe.category === 'distribution' ? 2.5 : 1.5;

  return (
    <Polyline
      key={`highlight-${pipe.id}`}
      positions={[start, end]}
      pathOptions={{
        color: SELECTED_COLOR,
        weight: baseWeight + 4,
        opacity: 1,
        interactive: false,
      }}
    />
  );
};

export default SelectionHighlight;

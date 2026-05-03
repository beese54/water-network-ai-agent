import React from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';
import type { NetworkPipe } from '../../types/network';
import type { PipeResult } from '../../types/simulation';
import { useNetworkStore } from '../../store/networkStore';

interface Props {
  pipes: NetworkPipe[];
  pipeResultMap: Record<string, PipeResult>;
}

const CATEGORY_COLOR: Record<string, string> = {
  trunk: '#1565c0',
  distribution: '#1976d2',
  service: '#607d8b',
  valve: '#7b1fa2',
};

function bearing(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const lat1 = toRad(a[0]), lon1 = toRad(a[1]);
  const lat2 = toRad(b[0]), lon2 = toRad(b[1]);
  const dLon = lon2 - lon1;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function midpoint(a: [number, number], b: [number, number]): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function makeArrowIcon(angleDeg: number, color: string): L.DivIcon {
  // Arrow polygon points upward (0°), rotated by angleDeg
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14">
    <polygon points="7,1 13,13 7,9 1,13" fill="${color}" stroke="white" stroke-width="1" stroke-linejoin="round"/>
  </svg>`;
  return L.divIcon({
    html: `<div style="transform:rotate(${angleDeg}deg);width:14px;height:14px;">${svg}</div>`,
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

const FlowArrowLayer: React.FC<Props> = ({ pipes, pipeResultMap }) => {
  const topology = useNetworkStore(s => s.topology);

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
        const result = pipeResultMap[pipe.id];
        if (!result || Math.abs(result.flow_lps) < 0.001) return null;

        const start = nodePos[pipe.start_node];
        const end = nodePos[pipe.end_node];
        if (!start || !end) return null;

        const baseBearing = bearing(start, end);
        // Negative flow means water flows end→start (reverse)
        const angleDeg = result.flow_lps >= 0 ? baseBearing : (baseBearing + 180) % 360;
        const mid = midpoint(start, end);
        const color = CATEGORY_COLOR[pipe.category] ?? '#78909c';

        return (
          <Marker
            key={`arrow-${pipe.id}`}
            position={mid}
            icon={makeArrowIcon(angleDeg, color)}
            interactive={false}
            zIndexOffset={-100}
          />
        );
      })}
    </>
  );
};

export default FlowArrowLayer;

import React from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type { NetworkReservoir } from '../../types/network';

// Custom reservoir icon using an SVG circle with a blue fill
const reservoirIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:20px;height:20px;
    background:#1565c0;border:2px solid #fff;
    border-radius:50%;
    box-shadow:0 0 6px rgba(21,101,192,0.7);
    display:flex;align-items:center;justify-content:center;
    color:white;font-size:10px;font-weight:bold;
  ">R</div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

interface Props {
  reservoir: NetworkReservoir;
}

const ReservoirMarker: React.FC<Props> = ({ reservoir }) => (
  <Marker position={[reservoir.lat, reservoir.lon]} icon={reservoirIcon}>
    <Tooltip sticky>
      <strong>Bukit Batok Service Reservoir</strong>
      <br />
      Head: {reservoir.head_m}m ASL
    </Tooltip>
  </Marker>
);

export default ReservoirMarker;

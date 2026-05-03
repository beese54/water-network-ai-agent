import React from 'react';
import { Polygon, Tooltip } from 'react-leaflet';
import type { NetworkZone } from '../../types/network';

const ZONE_COLORS: Record<string, string> = {
  bukit_batok_central: '#1976d2',
  bukit_batok_west:    '#388e3c',
  bukit_batok_east:    '#f57c00',
  bukit_gombak:        '#7b1fa2',
};

interface Props {
  zones: NetworkZone[];
}

const ZoneOverlay: React.FC<Props> = ({ zones }) => (
  <>
    {zones.map(zone => {
      const coords = zone.boundary.coordinates as [number, number][];
      if (coords.length < 3) return null;
      const color = ZONE_COLORS[zone.id] ?? '#607d8b';
      return (
        <Polygon
          key={zone.id}
          positions={coords}
          pathOptions={{
            color,
            fillColor: color,
            fillOpacity: 0.06,
            weight: 1.5,
            dashArray: '4 4',
          }}
        >
          <Tooltip sticky>
            <strong>{zone.display_name}</strong>
            <br />
            {zone.node_ids.length} nodes
          </Tooltip>
        </Polygon>
      );
    })}
  </>
);

export default ZoneOverlay;

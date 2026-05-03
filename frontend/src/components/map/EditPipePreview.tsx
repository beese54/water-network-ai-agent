import React from 'react';
import { Polyline, useMapEvents } from 'react-leaflet';
import { useEditStore } from '../../store/editStore';
import { useNetworkStore } from '../../store/networkStore';

const EditPipePreview: React.FC = () => {
  const activeTool = useEditStore((s) => s.activeTool);
  const pipeSourceNodeId = useEditStore((s) => s.pipeSourceNodeId);
  const cursorLatLng = useEditStore((s) => s.cursorLatLng);
  const setCursorLatLng = useEditStore((s) => s.setCursorLatLng);
  const nodes = useNetworkStore((s) => s.topology?.nodes);

  useMapEvents({
    mousemove(e) {
      if (activeTool === 'addPipe' && pipeSourceNodeId !== null) {
        setCursorLatLng({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });

  if (activeTool !== 'addPipe' || pipeSourceNodeId === null || cursorLatLng === null) {
    return null;
  }

  const src = nodes?.find((n) => n.id === pipeSourceNodeId);
  if (!src) return null;

  return (
    <Polyline
      positions={[
        [src.lat, src.lon],
        [cursorLatLng.lat, cursorLatLng.lng],
      ]}
      pathOptions={{ color: '#2563eb', weight: 2, dashArray: '8 6', opacity: 0.8 }}
    />
  );
};

export default EditPipePreview;

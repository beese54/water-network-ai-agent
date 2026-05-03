import React from 'react';
import { CircleMarker, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type { NetworkNode } from '../../types/network';
import type { NodeImpact } from '../../types/simulation';
import { pressureToColor } from '../../utils/pressureColor';
import type { EditTool } from '../../store/editStore';

interface Props {
  nodes: NetworkNode[];
  pressureMap: Record<string, number>;
  onNodeClick?: (node: NetworkNode) => void;
  nodeImpactMap?: Record<string, NodeImpact>;
  editMode?: boolean;
  activeTool?: EditTool;
  onNodeDragEnd?: (nodeId: string, lat: number, lng: number) => void;
}

function makeEditIcon(fillColor: string, activeTool: EditTool): L.DivIcon {
  const isDraggable = activeTool === 'select';
  const cursor = isDraggable ? 'move' : activeTool === 'delete' ? 'pointer' : 'crosshair';
  return L.divIcon({
    className: '',
    html: `<div style="width:12px;height:12px;border-radius:50%;background:${fillColor};border:2.5px solid white;box-shadow:0 0 4px rgba(0,0,0,0.45);cursor:${cursor};box-sizing:border-box;"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

const NodeLayer: React.FC<Props> = ({
  nodes,
  pressureMap,
  onNodeClick,
  nodeImpactMap,
  editMode = false,
  activeTool = 'select',
  onNodeDragEnd,
}) => {
  return (
    <>
      {nodes.map((node) => {
        const pressure = pressureMap[node.id];
        const impact = nodeImpactMap?.[node.id];
        const isIsolated = impact?.side === 'downstream';

        let fillColor: string;
        let borderColor: string;
        let borderWeight: number;
        let radius: number;
        let fillOpacity: number;

        if (isIsolated) {
          fillColor = '#212121';
          borderColor = '#e53935';
          borderWeight = 1.5;
          radius = 6;
          fillOpacity = 1;
        } else {
          const hasPressure = pressure !== undefined;
          fillColor = hasPressure ? pressureToColor(pressure) : '#78909c';
          borderColor = hasPressure ? '#333' : '#90a4ae';
          borderWeight = 0.5;
          radius = hasPressure ? 5 : 3;
          fillOpacity = 0.85;
        }

        const tooltip = (
          <Tooltip sticky>
            <strong>{node.id}</strong>
            {isIsolated && (
              <><br /><span style={{ color: '#e53935', fontWeight: 700 }}>⚠ No supply after shutdown</span></>
            )}
            <br />
            Zone: {node.zone ?? 'N/A'}
            <br />
            Elevation: {node.elevation_m.toFixed(1)} m ASL
            {pressure !== undefined && !isIsolated && (
              <>
                <br />
                Pressure: <strong>{pressure.toFixed(2)} bar</strong>
                {pressure < 1.0 && (
                  <span style={{ color: '#e53935' }}> ⚠ Below 1 bar</span>
                )}
              </>
            )}
            {isIsolated && impact && (
              <>
                <br />
                Baseline: {impact.baseline_pressure_bar.toFixed(2)} bar → 0 bar
              </>
            )}
            {editMode && activeTool === 'delete' && (
              <><br /><span style={{ color: '#e53935' }}>Click to delete</span></>
            )}
          </Tooltip>
        );

        if (editMode) {
          const icon = makeEditIcon(
            activeTool === 'delete' ? '#ef9a9a' : fillColor,
            activeTool,
          );
          const isDraggable = activeTool === 'select';

          return (
            <Marker
              key={node.id}
              position={[node.lat, node.lon]}
              icon={icon}
              draggable={isDraggable}
              eventHandlers={{
                click(e) {
                  e.originalEvent.stopPropagation();
                  onNodeClick?.(node);
                },
                dragend(e) {
                  const pos = (e.target as L.Marker).getLatLng();
                  onNodeDragEnd?.(node.id, pos.lat, pos.lng);
                },
              }}
            >
              {tooltip}
            </Marker>
          );
        }

        return (
          <CircleMarker
            key={node.id}
            center={[node.lat, node.lon]}
            radius={radius}
            pathOptions={{ fillColor, color: borderColor, weight: borderWeight, fillOpacity }}
            eventHandlers={{ click: (e) => { e.originalEvent.stopPropagation(); onNodeClick?.(node); } }}
          >
            {tooltip}
          </CircleMarker>
        );
      })}
    </>
  );
};

export default NodeLayer;

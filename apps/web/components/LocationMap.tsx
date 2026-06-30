'use client';

import { MapContainer, TileLayer, CircleMarker, Circle, Polyline, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { PanelPosition, GeofenceRow, TrackPoint } from '@/lib/location';

// Mapa do painel do padrinho (Leaflet + OpenStreetMap, sem chave). Carregado via next/dynamic
// (ssr:false) — react-leaflet não suporta SSR. Usa CircleMarker (sem assets de ícone).

function ClickToAdd({ onAdd }: { onAdd: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onAdd(e.latlng.lat, e.latlng.lng) });
  return null;
}

const DEFAULT_CENTER: [number, number] = [-14.235, -51.925]; // Brasil
const fmt = (iso: string) => new Date(iso).toLocaleString('pt-BR');

export default function LocationMap({
  positions,
  geofences,
  track,
  addMode,
  onAddAt,
}: {
  positions: PanelPosition[];
  geofences: GeofenceRow[];
  track: TrackPoint[];
  addMode: boolean;
  onAddAt: (lat: number, lng: number) => void;
}) {
  const first = positions[0];
  const center: [number, number] = first ? [first.lat, first.lng] : DEFAULT_CENTER;
  const zoom = first ? 13 : 4;

  return (
    <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
      <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {addMode && <ClickToAdd onAdd={onAddAt} />}

      {geofences.map((g) => (
        <Circle key={g.id} center={[g.lat, g.lng]} radius={g.radiusM} pathOptions={{ color: '#7C6CF5', fillColor: '#7C6CF5', fillOpacity: 0.08 }} />
      ))}

      {track.length > 1 && (
        <Polyline positions={track.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: '#2BE5C2', weight: 3, opacity: 0.8 }} />
      )}

      {positions.map((p) => (
        <CircleMarker
          key={p.debtorId}
          center={[p.lat, p.lng]}
          radius={9}
          pathOptions={{ color: '#fff', weight: 2, fillColor: p.online ? '#3FBF7F' : '#9CA3AF', fillOpacity: 1 }}
        >
          <Popup>
            <strong>{p.debtorName}</strong>
            <br />
            {p.online ? 'Compartilhando agora' : 'Sem atualização recente'}
            <br />
            <span style={{ color: '#6B7280' }}>Última atualização: {fmt(p.recordedAt)}</span>
            {p.battery != null && <><br />Bateria: {p.battery}%</>}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Polyline, Popup, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import type { PanelPosition, GeofenceRow, TrackPoint } from '@/lib/location';

// Mapa do painel do padrinho (Leaflet). Carregado via next/dynamic (ssr:false).
//
// Tiles CONFIGURÁVEIS por env — em produção use um provedor com chave (MapTiler/Stadia/etc.),
// pois o servidor público do OpenStreetMap proíbe uso pesado. Sem env, cai no OSM (só dev):
//   NEXT_PUBLIC_MAP_TILE_URL="https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key=SUA_CHAVE"
//   NEXT_PUBLIC_MAP_TILE_ATTRIBUTION="&copy; MapTiler &copy; OpenStreetMap"
const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL ?? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION ?? '&copy; OpenStreetMap';

const DEFAULT_CENTER: [number, number] = [-14.235, -51.925]; // Brasil
const fmt = (iso: string) => new Date(iso).toLocaleString('pt-BR');

// Marcador do cliente: ponto colorido (online/offline) via divIcon — sem assets de ícone.
function clientIcon(online: boolean): L.DivIcon {
  const color = online ? '#3FBF7F' : '#9CA3AF';
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function ClickToAdd({ onAdd }: { onAdd: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onAdd(e.latlng.lat, e.latlng.lng) });
  return null;
}

// Ao carregar, enquadra TODOS os clientes (o mapa vai para onde eles estão). Uma vez só.
function FitToClients({ positions }: { positions: PanelPosition[] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || positions.length === 0) return;
    done.current = true;
    if (positions.length === 1) {
      map.setView([positions[0]!.lat, positions[0]!.lng], 15, { animate: true });
    } else {
      const bounds = L.latLngBounds(positions.map((p) => [p.lat, p.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16, animate: true });
    }
  }, [positions, map]);
  return null;
}

function EmptyMap() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-center px-8">
      <span className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(43,229,194,0.12)' }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2BE5C2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      </span>
      <p className="font-sans text-sm text-text">Ninguém compartilhando agora</p>
      <p className="font-sans text-xs text-muted mt-1 max-w-[260px]">Quando alguém ativar a localização, o mapa vai direto até onde estão os seus clientes.</p>
    </div>
  );
}

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
  // Sem clientes, sem cercas e fora do modo-adicionar → não monta o mapa-múndi (UX + tiles).
  if (positions.length === 0 && geofences.length === 0 && !addMode) return <EmptyMap />;

  const anchor = positions[0] ?? geofences[0];
  const center: [number, number] = anchor ? [anchor.lat, anchor.lng] : DEFAULT_CENTER;
  const zoom = anchor ? 13 : 4;

  return (
    <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
      <TileLayer attribution={TILE_ATTR} url={TILE_URL} />
      <FitToClients positions={positions} />
      {addMode && <ClickToAdd onAdd={onAddAt} />}

      {geofences.map((g) => (
        <Circle key={g.id} center={[g.lat, g.lng]} radius={g.radiusM} pathOptions={{ color: '#7C6CF5', fillColor: '#7C6CF5', fillOpacity: 0.08 }} />
      ))}

      {track.length > 1 && (
        <Polyline positions={track.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: '#2BE5C2', weight: 3, opacity: 0.8 }} />
      )}

      {/* Clientes agrupados: concentrações viram um círculo com a contagem (onde há mais clientes). */}
      <MarkerClusterGroup chunkedLoading showCoverageOnHover={false} maxClusterRadius={50}>
        {positions.map((p) => (
          <Marker key={p.debtorId} position={[p.lat, p.lng]} icon={clientIcon(p.online)}>
            <Popup>
              <strong>{p.debtorName}</strong>
              <br />
              {p.online ? 'Compartilhando agora' : 'Sem atualização recente'}
              <br />
              <span style={{ color: '#6B7280' }}>Última atualização: {fmt(p.recordedAt)}</span>
              {p.battery != null && <><br />Bateria: {p.battery}%</>}
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}

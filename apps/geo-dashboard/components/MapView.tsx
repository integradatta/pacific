'use client';

import { useEffect, useRef, useState } from 'react';
import type { LatLng } from '@pacific/geo-shared';
import { createMapProvider, type MapMarker, type MapProvider } from '@/lib/map';
import type { GeofenceRow, PositionRow } from '@/lib/api';

const DEFAULT_CENTER: LatLng = { lat: -23.55, lng: -46.63 }; // São Paulo

export function MapView({ positions, geofences }: { positions: PositionRow[]; geofences: GeofenceRow[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const providerRef = useRef<MapProvider | null>(null);
  const markersRef = useRef<Map<string, MapMarker>>(new Map());
  const [ready, setReady] = useState(false);

  // Monta o mapa uma vez (via MapProvider — abstração que isola o MapLibre).
  useEffect(() => {
    let disposed = false;
    const el = containerRef.current;
    if (!el) return;
    const markers = markersRef.current;
    void (async () => {
      const provider = await createMapProvider('maplibre');
      if (disposed) return;
      await provider.mount(el, { center: positions[0] ?? DEFAULT_CENTER, zoom: 12 });
      providerRef.current = provider;
      setReady(true);
    })();
    return () => {
      disposed = true;
      providerRef.current?.destroy();
      providerRef.current = null;
      markers.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atualiza marcadores quando as posições mudam.
  useEffect(() => {
    const provider = providerRef.current;
    if (!ready || !provider) return;
    const seen = new Set<string>();
    for (const p of positions) {
      seen.add(p.user_id);
      const existing = markersRef.current.get(p.user_id);
      if (existing) existing.setPosition({ lat: p.lat, lng: p.lng });
      else markersRef.current.set(p.user_id, provider.addMarker({ lat: p.lat, lng: p.lng }, { title: p.user_id }));
    }
    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }
    if (positions.length > 0) provider.fitBounds(positions.map((p) => ({ lat: p.lat, lng: p.lng })));
  }, [ready, positions]);

  // Desenha as geofences (círculos em metros).
  useEffect(() => {
    const provider = providerRef.current;
    if (!ready || !provider) return;
    for (const g of geofences) {
      provider.setCircle(`gf-${g.id}`, { lat: g.lat, lng: g.lng }, g.radius_meters, { color: '#F0A03C' });
    }
  }, [ready, geofences]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

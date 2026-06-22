'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Socket } from 'socket.io-client';
import { MapView } from '@/components/MapView';
import { apiGet, type GeofenceRow, type PositionRow } from '@/lib/api';
import { connectRealtime } from '@/lib/realtime';

export default function GroupMapPage({ params }: { params: { id: string } }) {
  const groupId = params.id;
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [geofences, setGeofences] = useState<GeofenceRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    Promise.all([
      apiGet<PositionRow[]>(`/api/v1/groups/${groupId}/locations/latest`),
      apiGet<GeofenceRow[]>(`/api/v1/groups/${groupId}/geofences`),
    ])
      .then(([pos, gf]) => {
        setPositions(pos);
        setGeofences(gf);
      })
      .catch((e: Error) => setError(e.message));

    // Tempo real: atualiza a posição do usuário ao receber location_update.
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('geo_token') : null;
    const socket = connectRealtime(groupId, token, {
      onLocation: (p) =>
        setPositions((prev) => {
          const next = prev.filter((x) => x.user_id !== p.userId);
          next.push({ user_id: p.userId, lat: p.lat, lng: p.lng, recorded_at: p.recordedAt });
          return next;
        }),
    });
    socketRef.current = socket;
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [groupId]);

  return (
    <main style={{ display: 'grid', gridTemplateColumns: '300px 1fr', height: '100vh' }}>
      <aside style={{ borderRight: '1px solid #1F2837', padding: 16, overflowY: 'auto', background: '#121826' }}>
        <Link href="/" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: 2 }}>
          ← Grupos
        </Link>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginTop: 12 }}>Mapa do grupo</h1>
        {error && <p style={{ color: '#F0556A', fontSize: 12, fontFamily: 'ui-monospace, monospace' }}>API indisponível ({error}).</p>}

        <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: '#7E899D', textTransform: 'uppercase', letterSpacing: 2, marginTop: 16 }}>
          Compartilhando ({positions.length})
        </p>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {positions.map((p) => (
            <li key={p.user_id} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid #1F2837' }}>
              <span style={{ color: '#2BE5C2' }}>●</span> {p.user_id.slice(0, 8)}…
              <span style={{ color: '#7E899D', fontSize: 11, marginLeft: 6 }}>{new Date(p.recorded_at).toLocaleTimeString('pt-BR')}</span>
            </li>
          ))}
        </ul>

        <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: '#7E899D', textTransform: 'uppercase', letterSpacing: 2, marginTop: 16 }}>
          Geofences ({geofences.length})
        </p>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {geofences.map((g) => (
            <li key={g.id} style={{ fontSize: 13, padding: '4px 0' }}>
              <span style={{ color: '#F0A03C' }}>◯</span> {g.name} · {Math.round(g.radius_meters)}m
            </li>
          ))}
        </ul>
      </aside>

      <div style={{ position: 'relative' }}>
        <MapView positions={positions} geofences={geofences} />
      </div>
    </main>
  );
}

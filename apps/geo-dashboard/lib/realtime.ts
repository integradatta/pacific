import { io, type Socket } from 'socket.io-client';
import type { PositionRow } from './api.js';
import { GEO_API_BASE } from './api.js';

export interface RealtimeHandlers {
  onLocation?: (p: { userId: string; lat: number; lng: number; recordedAt: string }) => void;
  onStatusChange?: (p: { userId: string; status: string }) => void;
  onGeofenceAlert?: (p: { userId: string; geofenceId: string; eventType: string }) => void;
}

/** Conecta ao gateway /ws/locations, entra na room do grupo e despacha os eventos. */
export function connectRealtime(groupId: string, token: string | null, handlers: RealtimeHandlers): Socket {
  const socket = io(`${GEO_API_BASE}/ws/locations`, {
    transports: ['websocket'],
    auth: { token: token ?? '' },
  });
  socket.on('connect', () => socket.emit('subscribe_group', { groupId }));
  if (handlers.onLocation) socket.on('location_update', handlers.onLocation);
  if (handlers.onStatusChange) socket.on('status_change', handlers.onStatusChange);
  if (handlers.onGeofenceAlert) socket.on('geofence_alert', handlers.onGeofenceAlert);
  return socket;
}

export type { PositionRow };

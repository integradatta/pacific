'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from './api';

export interface PanelPosition {
  debtorId: string;
  debtorName: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  battery: number | null;
  recordedAt: string;
  online: boolean;
}
export interface GeofenceRow { id: string; label: string; lat: number; lng: number; radiusM: number }
export interface DeclineRow { debtorId: string; debtorName: string; declinedAt: string | null }
export interface TrackPoint { lat: number; lng: number; recordedAt: string }

/** Posições ao vivo dos devedores que consentiram — polling a cada 30s (MVP). */
export function usePositions() {
  return useQuery({ queryKey: ['location', 'positions'], queryFn: () => apiGet<PanelPosition[]>('/location/positions'), refetchInterval: 30_000 });
}

/** Devedores que recusaram o compartilhamento (notificação ao padrinho). */
export function useDeclines() {
  return useQuery({ queryKey: ['location', 'declines'], queryFn: () => apiGet<DeclineRow[]>('/location/declines') });
}

export function useGeofences() {
  return useQuery({ queryKey: ['location', 'geofences'], queryFn: () => apiGet<GeofenceRow[]>('/location/geofences') });
}

export function useCreateGeofence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { label: string; lat: number; lng: number; radiusM: number }) => apiPost<GeofenceRow>('/location/geofences', input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['location', 'geofences'] }),
  });
}

export function useDeleteGeofence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/location/geofences/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['location', 'geofences'] }),
  });
}

/** Trajeto de um devedor (carrega sob demanda quando selecionado). */
export function useDebtorTrack(debtorId: string | null) {
  return useQuery({
    queryKey: ['location', 'track', debtorId],
    queryFn: () => apiGet<TrackPoint[]>(`/location/debtors/${debtorId}/history`),
    enabled: !!debtorId,
  });
}

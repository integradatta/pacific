'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { debtorApiGet, debtorApiPost } from './debtor';

export type ConsentState = 'NEVER' | 'DECLINED' | 'GRANTED' | 'REVOKED';

export function useMyConsent() {
  return useQuery({ queryKey: ['my-consent'], queryFn: () => debtorApiGet<{ state: ConsentState; updatedAt: string | null }>('/debtor/me/location/consent') });
}

export function useSetMyConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { state: 'GRANTED' | 'DECLINED' | 'REVOKED'; consentText?: string }) =>
      debtorApiPost<{ state: ConsentState }>('/debtor/me/location/consent', input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['my-consent'] }),
  });
}

/**
 * Captura de localização em FOREGROUND (app aberto) via Geolocation API + envio em lote.
 * Funciona em PWA/webview. Background contínuo exige plugin nativo (Capacitor) — ver
 * docs/LOCATION_DESIGN.md §0.1. Só roda quando `active` (consentimento GRANTED).
 */
export function useLocationSharing(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !navigator.geolocation) return;
    let buffer: Array<{ lat: number; lng: number; accuracy: number | null; recordedAt: string }> = [];

    const flush = async () => {
      if (buffer.length === 0) return;
      const points = buffer;
      buffer = [];
      await debtorApiPost('/debtor/me/location/ping', { points }).catch(() => {
        /* best-effort; descarta o lote em falha para não acumular indefinidamente */
      });
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        buffer.push({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : null, recordedAt: new Date().toISOString() });
        if (buffer.length >= 5) void flush();
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 27_000 },
    );
    const interval = setInterval(() => void flush(), 60_000);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(interval);
      void flush();
    };
  }, [active]);
}

import type { IncomingPoint, LatLng } from './types.js';

export const MAX_ACCURACY_METERS = 500;
export const REJECT_SPEED_MPS = 340; // ~1224 km/h → anomalia/teleporte
export const SUSPICIOUS_SPEED_MPS = 55; // ~200 km/h
export const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
export const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const R = 6_371_000; // raio da Terra (m)
const rad = (d: number): number => (d * Math.PI) / 180;

/** Distância em metros entre dois pontos (haversine). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const lat1 = rad(a.lat);
  const lat2 = rad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface PreviousPoint {
  lat: number;
  lng: number;
  recordedAt: string;
}

export interface PointValidation {
  accept: boolean;
  reason?: string; // motivo da rejeição
  flags: string[]; // marcações (ex.: 'suspicious')
}

/**
 * Valida um ponto recebido (spec §3.2): accuracy, timestamp e velocidade vs. ponto anterior.
 * Rejeita accuracy > 500m, timestamp futuro (> 5min) ou velho (> 24h), e teleporte (> 340 m/s).
 * Marca como 'suspicious' (mas aceita) velocidade > 55 m/s com source = gps.
 */
export function validateIncomingPoint(point: IncomingPoint, previous: PreviousPoint | null, now: Date): PointValidation {
  const flags: string[] = [];

  if (point.accuracyMeters > MAX_ACCURACY_METERS) {
    return { accept: false, reason: 'low_accuracy', flags };
  }

  const recordedMs = new Date(point.recordedAt).getTime();
  if (Number.isNaN(recordedMs)) return { accept: false, reason: 'invalid_timestamp', flags };
  const drift = recordedMs - now.getTime();
  if (drift > FUTURE_TOLERANCE_MS) return { accept: false, reason: 'future_timestamp', flags };
  if (now.getTime() - recordedMs > MAX_AGE_MS) return { accept: false, reason: 'stale_timestamp', flags };

  if (previous) {
    const dtSec = (recordedMs - new Date(previous.recordedAt).getTime()) / 1000;
    if (dtSec > 0) {
      const dist = haversineMeters(previous, point);
      const speed = dist / dtSec;
      if (speed > REJECT_SPEED_MPS) return { accept: false, reason: 'teleport', flags };
      if (speed > SUSPICIOUS_SPEED_MPS && point.source === 'gps') flags.push('suspicious');
    }
  }

  return { accept: true, flags };
}

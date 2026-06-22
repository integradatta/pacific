import type { GeofenceEventType, Schedule } from './types.js';

// Margem de histerese anti-bounce (spec §1.7): 20% do raio. Banda morta = [0.8r, 1.2r].
const HYSTERESIS = 0.2;

export interface GeofenceEval {
  inside: boolean;
  event: GeofenceEventType | null;
}

/**
 * Avalia uma posição contra uma geofence com histerese anti-bounce.
 * - distance <= 0.8r → dentro; emite 'enter' se antes estava fora.
 * - distance >= 1.2r → fora; emite 'exit' se antes estava dentro.
 * - na banda morta (entre 0.8r e 1.2r) → mantém o estado anterior, sem evento.
 * - primeira observação (prevInside = null) → estabelece o estado sem emitir evento.
 */
export function evaluateGeofence(distanceMeters: number, radiusMeters: number, prevInside: boolean | null): GeofenceEval {
  const inner = radiusMeters * (1 - HYSTERESIS);
  const outer = radiusMeters * (1 + HYSTERESIS);

  let inside: boolean;
  if (distanceMeters <= inner) inside = true;
  else if (distanceMeters >= outer) inside = false;
  else inside = prevInside ?? false; // banda morta: mantém estado (ou fora, se desconhecido)

  if (prevInside === null) return { inside, event: null };
  if (!prevInside && inside) return { inside, event: 'enter' };
  if (prevInside && !inside) return { inside, event: 'exit' };
  return { inside, event: null };
}

function parseHHMM(s: string): number {
  const [h, m] = s.split(':');
  return Number(h) * 60 + Number(m);
}

/**
 * Verifica se um instante está dentro da janela da geofence. `schedule = null` → sempre ativo.
 * `isoWeekday`: 1=Seg … 7=Dom. `minutesOfDay`: minutos desde 00:00 (no fuso de referência do grupo).
 * Suporta janelas que cruzam a meia-noite (start > end).
 */
export function isWithinSchedule(isoWeekday: number, minutesOfDay: number, schedule: Schedule | null): boolean {
  if (!schedule) return true;
  if (!schedule.days.includes(isoWeekday)) return false;
  const start = parseHHMM(schedule.start);
  const end = parseHHMM(schedule.end);
  if (start <= end) return minutesOfDay >= start && minutesOfDay <= end;
  // janela cruza a meia-noite (ex.: 22:00–06:00)
  return minutesOfDay >= start || minutesOfDay <= end;
}

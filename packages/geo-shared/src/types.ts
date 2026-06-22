// Tipos e enums do módulo de geolocalização em grupo. Domínio próprio — NÃO referencia
// nada do módulo financeiro. user_id/tenant_id são UUIDs opacos vindos do JWT.

export type GroupType = 'supervised' | 'collaborative';
export type MemberRole = 'admin' | 'participant' | 'supervised_participant';
export type SharingStatus = 'active' | 'paused' | 'revoked' | 'unavailable';
export type MemberStatus = 'active' | 'removed' | 'left';
export type LocationSource = 'gps' | 'network' | 'fused';
export type AlertType = 'on_enter' | 'on_exit' | 'both';
export type GeofenceEventType = 'enter' | 'exit';
export type Platform = 'ios' | 'android';

export interface LatLng {
  lat: number;
  lng: number;
}

/** Ponto recebido do dispositivo (payload de /locations). */
export interface IncomingPoint {
  lat: number;
  lng: number;
  accuracyMeters: number;
  altitudeMeters?: number | null;
  speedMps?: number | null;
  headingDegrees?: number | null;
  batteryLevel?: number | null;
  source: LocationSource;
  recordedAt: string; // ISO 8601 (timestamp do dispositivo)
}

/**
 * Janela de horário de uma geofence. `days` em ISO-8601 (1=Seg … 7=Dom) para casar com o
 * exemplo da spec (`[1,2,3,4,5]` = dias úteis). `start`/`end` em "HH:MM" (24h).
 */
export interface Schedule {
  days: number[];
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

/** Resultado de uma verificação de regra: permitido, ou negado com status HTTP + mensagem. */
export type RuleResult = { allowed: true } | { allowed: false; status: number; message: string };

export const ALLOW: RuleResult = { allowed: true };
export const deny = (status: number, message: string): RuleResult => ({ allowed: false, status, message });

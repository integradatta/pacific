// Pontos de extensão para um futuro Módulo de Localização (opcional).
// SOMENTE interfaces/tipos — nenhuma implementação.
export interface GeoPoint { lat: number; lng: number; }

export interface LivePosition extends GeoPoint {
  debtorId: string;
  recordedAt: string;      // ISO 8601
  online: boolean;
  battery: number | null;  // 0-100
  accuracy: number | null; // metros
}

export interface Geofence { id: string; label: string; center: GeoPoint; radiusM: number; }

export type LocationEventType = 'ARRIVAL' | 'DEPARTURE';
export interface LocationEvent { debtorId: string; type: LocationEventType; geofenceId: string; occurredAt: string; }

export type ConsentState = 'NEVER' | 'GRANTED' | 'REVOKED';
export interface LocationConsent {
  debtorId: string; state: ConsentState; grantedAt: string | null; revokedAt: string | null; updatedAt: string;
}

export interface LocationHistoryQuery { debtorId: string; from: string; to: string; limit?: number; cursor?: string; }
export interface LocationHistoryPage { entries: LivePosition[]; nextCursor: string | null; }

/** Port de consulta de histórico. */
export interface LocationHistory { query(params: LocationHistoryQuery): Promise<LocationHistoryPage>; }

/** Port: fonte de posições (provider plugável — tempo real). */
export interface LocationProvider {
  readonly id: string;
  getLastPosition(debtorId: string): Promise<LivePosition | null>;
  subscribe(debtorId: string, onPosition: (p: LivePosition) => void): () => void;
}

/** Facade consumida pela aplicação (consent + provider + geofencing). */
export interface LocationService {
  getConsent(debtorId: string): Promise<LocationConsent>;
  setConsent(debtorId: string, granted: boolean): Promise<LocationConsent>;
  getLastPosition(debtorId: string): Promise<LivePosition | null>;
  history: LocationHistory;
  listGeofences(debtorId: string): Promise<Geofence[]>;
  onLocationEvent(handler: (e: LocationEvent) => void): () => void;
}

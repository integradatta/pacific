// Contrato de publicação em tempo real (desacopla serviços do gateway socket.io → testável).
export interface RealtimePublisher {
  broadcast(groupId: string, event: RealtimeEvent, payload: unknown): void;
}

export type RealtimeEvent = 'location_update' | 'status_change' | 'geofence_alert' | 'member_joined' | 'member_left';

export const REALTIME = Symbol('REALTIME');

/** Implementação no-op (default em testes ou quando o gateway está desabilitado). */
export class NoopRealtime implements RealtimePublisher {
  broadcast(): void {
    /* no-op */
  }
}

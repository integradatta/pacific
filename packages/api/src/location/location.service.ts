import { ForbiddenException, Injectable } from '@nestjs/common';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';
import { TrackingService } from '../tracking/tracking.service.js';

// Módulo de Localização — compartilhamento CONSENTIDO (ver docs/LOCATION_DESIGN.md).
// Posição real só de devedores GRANTED. Tudo dentro de withTenant (RLS + escopo por código).

export type ConsentState = 'NEVER' | 'DECLINED' | 'GRANTED' | 'REVOKED';
type SettableConsent = 'GRANTED' | 'DECLINED' | 'REVOKED';

export interface PingPoint { lat: number; lng: number; accuracy?: number | null; battery?: number | null; recordedAt: string }
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

const ONLINE_WINDOW_MS = Number(process.env.LOCATION_ONLINE_WINDOW_MS ?? 10 * 60_000);

function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

@Injectable()
export class LocationService {
  constructor(
    private readonly scoped: TenantScopedService,
    private readonly tracking: TrackingService,
  ) {}

  // ── SOBRINHO ──────────────────────────────────────────────────────────────
  async getConsent(tenantId: string, debtorId: string): Promise<{ state: ConsentState; updatedAt: string | null }> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const row = await tx.locationConsent.findUnique({ where: { debtorId } });
      return { state: (row?.state ?? 'NEVER') as ConsentState, updatedAt: row?.updatedAt.toISOString() ?? null };
    });
  }

  /** Define o consentimento. DECLINED é o gatilho da notificação ao padrinho (regra do produto). */
  async setConsent(tenantId: string, debtorId: string, state: SettableConsent, consentText?: string): Promise<{ state: ConsentState }> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const now = new Date();
      const stamps =
        state === 'GRANTED' ? { grantedAt: now } : state === 'DECLINED' ? { declinedAt: now } : { revokedAt: now };
      await tx.locationConsent.upsert({
        where: { debtorId },
        create: { debtorId, tenantId, state, consentText: consentText ?? null, ...stamps },
        update: { state, ...(consentText ? { consentText } : {}), ...stamps },
      });
      // Revogar para de exibir a posição ao vivo (histórico permanece até a retenção).
      if (state === 'REVOKED') await tx.debtorPosition.deleteMany({ where: { tenantId, debtorId } });
      await this.tracking.record(tx, { tenantId, actorType: 'DEBTOR', actorId: debtorId, type: 'LOCATION_CONSENT', targetType: 'debtor', targetId: debtorId, detail: { state } });
      return { state };
    });
  }

  /** Recebe pings em lote (só se GRANTED). Atualiza última posição, histórico e avalia geofences. */
  async recordPings(tenantId: string, debtorId: string, points: PingPoint[]): Promise<{ accepted: number }> {
    if (points.length === 0) return { accepted: 0 };
    return this.scoped.withTenant(tenantId, async (tx) => {
      const consent = await tx.locationConsent.findUnique({ where: { debtorId } });
      if (consent?.state !== 'GRANTED') throw new ForbiddenException('Compartilhamento de localização não está ativo.');

      const sorted = [...points].sort((a, b) => +new Date(a.recordedAt) - +new Date(b.recordedAt));
      await tx.locationPing.createMany({
        data: sorted.map((p) => ({ tenantId, debtorId, lat: p.lat, lng: p.lng, accuracy: p.accuracy ?? null, battery: p.battery ?? null, recordedAt: new Date(p.recordedAt) })),
      });

      const prev = await tx.debtorPosition.findUnique({ where: { debtorId } });
      const latest = sorted[sorted.length - 1]!;
      await tx.debtorPosition.upsert({
        where: { debtorId },
        create: { debtorId, tenantId, lat: latest.lat, lng: latest.lng, accuracy: latest.accuracy ?? null, battery: latest.battery ?? null, recordedAt: new Date(latest.recordedAt) },
        update: { lat: latest.lat, lng: latest.lng, accuracy: latest.accuracy ?? null, battery: latest.battery ?? null, recordedAt: new Date(latest.recordedAt) },
      });

      await this.evaluateGeofences(tx, tenantId, debtorId, prev ? { lat: Number(prev.lat), lng: Number(prev.lng) } : null, { lat: latest.lat, lng: latest.lng });
      return { accepted: sorted.length };
    });
  }

  // Entrada/saída de cerca: compara o conjunto "dentro" da posição anterior com o da nova.
  private async evaluateGeofences(
    tx: Parameters<Parameters<TenantScopedService['withTenant']>[1]>[0],
    tenantId: string,
    debtorId: string,
    prev: { lat: number; lng: number } | null,
    next: { lat: number; lng: number },
  ): Promise<void> {
    const fences = await tx.geofence.findMany({ where: { tenantId } });
    if (fences.length === 0) return;
    const inside = (pt: { lat: number; lng: number } | null, f: { lat: unknown; lng: unknown; radiusM: number }) =>
      pt != null && distanceM(pt, { lat: Number(f.lat), lng: Number(f.lng) }) <= f.radiusM;
    const events = fences.flatMap((f) => {
      const was = inside(prev, f);
      const now = inside(next, f);
      if (!was && now) return [{ tenantId, debtorId, geofenceId: f.id, type: 'ARRIVAL' }];
      if (was && !now) return [{ tenantId, debtorId, geofenceId: f.id, type: 'DEPARTURE' }];
      return [];
    });
    if (events.length > 0) await tx.geofenceEvent.createMany({ data: events });
  }

  // ── PADRINHO ──────────────────────────────────────────────────────────────
  /** Última posição de cada devedor GRANTED do tenant (alimenta o mapa). */
  async positions(tenantId: string, now: Date = new Date()): Promise<PanelPosition[]> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const granted = await tx.locationConsent.findMany({ where: { tenantId, state: 'GRANTED' }, select: { debtorId: true } });
      const ids = granted.map((g) => g.debtorId);
      if (ids.length === 0) return [];
      const [positions, debtors] = await Promise.all([
        tx.debtorPosition.findMany({ where: { tenantId, debtorId: { in: ids } } }),
        tx.debtor.findMany({ where: { tenantId, id: { in: ids } }, select: { id: true, name: true } }),
      ]);
      const nameById = new Map(debtors.map((d) => [d.id, d.name]));
      return positions.map((p) => ({
        debtorId: p.debtorId,
        debtorName: nameById.get(p.debtorId) ?? '—',
        lat: Number(p.lat),
        lng: Number(p.lng),
        accuracy: p.accuracy,
        battery: p.battery,
        recordedAt: p.recordedAt.toISOString(),
        online: now.getTime() - p.recordedAt.getTime() <= ONLINE_WINDOW_MS,
      }));
    });
  }

  /** Trajeto de um devedor (histórico de pings). */
  async history(tenantId: string, debtorId: string, from?: string, to?: string, limit = 500): Promise<Array<{ lat: number; lng: number; recordedAt: string }>> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const recordedAt = from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined;
      const rows = await tx.locationPing.findMany({
        where: { tenantId, debtorId, ...(recordedAt ? { recordedAt } : {}) },
        orderBy: { recordedAt: 'asc' },
        take: Math.min(Math.max(limit, 1), 2000),
      });
      return rows.map((r) => ({ lat: Number(r.lat), lng: Number(r.lng), recordedAt: r.recordedAt.toISOString() }));
    });
  }

  /** Devedores que RECUSARAM o compartilhamento (alimenta a notificação ao padrinho). */
  async declines(tenantId: string): Promise<Array<{ debtorId: string; debtorName: string; declinedAt: string | null }>> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const rows = await tx.locationConsent.findMany({ where: { tenantId, state: 'DECLINED' }, orderBy: { updatedAt: 'desc' } });
      if (rows.length === 0) return [];
      const debtors = await tx.debtor.findMany({ where: { tenantId, id: { in: rows.map((r) => r.debtorId) } }, select: { id: true, name: true } });
      const nameById = new Map(debtors.map((d) => [d.id, d.name]));
      return rows.map((r) => ({ debtorId: r.debtorId, debtorName: nameById.get(r.debtorId) ?? '—', declinedAt: r.declinedAt?.toISOString() ?? null }));
    });
  }

  async consentByDebtor(tenantId: string, debtorId: string): Promise<{ state: ConsentState; updatedAt: string | null }> {
    return this.getConsent(tenantId, debtorId);
  }

  // ── Geofences (padrinho) ────────────────────────────────────────────────────
  async listGeofences(tenantId: string): Promise<GeofenceRow[]> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const rows = await tx.geofence.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
      return rows.map((g) => ({ id: g.id, label: g.label, lat: Number(g.lat), lng: Number(g.lng), radiusM: g.radiusM }));
    });
  }
  async createGeofence(tenantId: string, input: { label: string; lat: number; lng: number; radiusM: number }): Promise<GeofenceRow> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const g = await tx.geofence.create({ data: { tenantId, label: input.label, lat: input.lat, lng: input.lng, radiusM: input.radiusM } });
      return { id: g.id, label: g.label, lat: Number(g.lat), lng: Number(g.lng), radiusM: g.radiusM };
    });
  }
  async deleteGeofence(tenantId: string, id: string): Promise<void> {
    await this.scoped.withTenant(tenantId, (tx) => tx.geofence.deleteMany({ where: { id, tenantId } }));
  }

  /** Depuração de pings antigos (job de retenção), por tenant (RLS). */
  async purgePings(tenantId: string, days: number, now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - days * 86_400_000);
    return this.scoped.withTenant(tenantId, async (tx) => {
      const r = await tx.locationPing.deleteMany({ where: { tenantId, recordedAt: { lt: cutoff } } });
      return r.count;
    });
  }
}

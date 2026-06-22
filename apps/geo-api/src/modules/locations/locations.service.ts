import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { validateIncomingPoint, type IncomingPoint } from '@pacific/geo-shared';
import { GEO_DB, type GeoDb, type Querier } from '../../common/geo-db.js';
import type { Principal } from '../../common/principal.js';
import { GeofencingService } from '../geofencing/geofencing.service.js';
import { REALTIME, type RealtimePublisher } from '../../realtime/realtime.js';
import { NotificationsService } from '../../notifications/notifications.service.js';

export interface IngestResult {
  accepted: boolean;
  reason?: string;
  flags: string[];
  groups: number; // em quantos grupos o ponto foi gravado
}

@Injectable()
export class LocationsService {
  constructor(
    @Inject(GEO_DB) private readonly db: GeoDb,
    private readonly geofencing: GeofencingService,
    @Inject(REALTIME) private readonly realtime: RealtimePublisher,
    private readonly notifications: NotificationsService,
  ) {}

  async ingest(p: Principal, deviceId: string, point: IncomingPoint, now: Date = new Date()): Promise<IngestResult> {
    return this.db.withTenant(p.tenantId, (q) => this.ingestOne(q, p, deviceId, point, now));
  }

  /** Lote (offline → reconexão). Processa em ordem de recordedAt; devolve aceitos/rejeitados. */
  async ingestBatch(p: Principal, deviceId: string, points: IncomingPoint[], now: Date = new Date()): Promise<{ accepted: number; rejected: number }> {
    return this.db.withTenant(p.tenantId, async (q) => {
      const ordered = [...points].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
      let accepted = 0;
      let rejected = 0;
      for (const pt of ordered) {
        const r = await this.ingestOne(q, p, deviceId, pt, now);
        if (r.accepted) accepted += 1;
        else rejected += 1;
      }
      return { accepted, rejected };
    });
  }

  private async ingestOne(q: Querier, p: Principal, deviceId: string, point: IncomingPoint, now: Date): Promise<IngestResult> {
    // grupos onde o usuário compartilha ativamente (consentimento ativo)
    const memberships = await q.query<{ group_id: string }>(
      `SELECT group_id FROM geo.group_member WHERE user_id = $1 AND status = 'active' AND sharing_status = 'active'`,
      [p.userId],
    );
    if (memberships.rowCount === 0) {
      throw new ForbiddenException('Compartilhamento de localização não está ativo em nenhum grupo.');
    }

    const prev = await q.query<{ lat: number; lng: number; recorded_at: string }>(
      `SELECT ST_Y(coordinates::geometry) AS lat, ST_X(coordinates::geometry) AS lng, recorded_at
       FROM geo.location_point WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
      [p.userId],
    );
    const previous = prev.rowCount === 0 ? null : { lat: prev.rows[0]!.lat, lng: prev.rows[0]!.lng, recordedAt: prev.rows[0]!.recorded_at };

    const v = validateIncomingPoint(point, previous, now);
    if (!v.accept) return { accepted: false, reason: v.reason, flags: v.flags, groups: 0 };

    const recordedAt = new Date(point.recordedAt);
    for (const m of memberships.rows) {
      await q.query(
        `INSERT INTO geo.location_point(user_id, tenant_id, group_id, device_id, coordinates, accuracy_meters, altitude_meters, speed_mps, heading_degrees, battery_level, source, recorded_at)
         VALUES ($1,$2,$3,$4, ST_SetSRID(ST_MakePoint($5,$6),4326)::geography, $7,$8,$9,$10,$11,$12,$13)`,
        [p.userId, p.tenantId, m.group_id, deviceId, point.lng, point.lat, point.accuracyMeters, point.altitudeMeters ?? null, point.speedMps ?? null, point.headingDegrees ?? null, point.batteryLevel ?? null, point.source, point.recordedAt],
      );
      const events = await this.geofencing.detectForPoint(q, p.tenantId, m.group_id, p.userId, { lat: point.lat, lng: point.lng }, recordedAt);
      this.realtime.broadcast(m.group_id, 'location_update', { userId: p.userId, lat: point.lat, lng: point.lng, recordedAt: point.recordedAt });
      for (const ev of events) {
        this.realtime.broadcast(m.group_id, 'geofence_alert', { userId: p.userId, geofenceId: ev.geofenceId, eventType: ev.eventType });
        await this.notifications.notifyGeofence(q, m.group_id, p.userId, ev.geofenceName, ev.eventType);
      }
    }
    await q.query(`UPDATE geo.user_device SET last_active_at = now() WHERE user_id = $1 AND device_id = $2`, [p.userId, deviceId]);

    return { accepted: true, flags: v.flags, groups: memberships.rowCount ?? 0 };
  }

  /** Histórico bruto (48h) de um usuário no grupo. */
  async history(p: Principal, groupId: string, userId: string, opts: { from?: string; to?: string; limit?: number } = {}) {
    return this.db.withTenant(p.tenantId, async (q) => {
      const limit = Math.min(Math.max(opts.limit ?? 500, 1), 5000);
      const r = await q.query(
        `SELECT ST_Y(coordinates::geometry) AS lat, ST_X(coordinates::geometry) AS lng, accuracy_meters, recorded_at
         FROM geo.location_point
         WHERE group_id = $1 AND user_id = $2
           AND ($3::timestamptz IS NULL OR recorded_at >= $3)
           AND ($4::timestamptz IS NULL OR recorded_at <= $4)
         ORDER BY recorded_at DESC LIMIT $5`,
        [groupId, userId, opts.from ?? null, opts.to ?? null, limit],
      );
      return r.rows;
    });
  }

  /** Última posição de cada membro que compartilha no grupo (painel). */
  async latest(p: Principal, groupId: string) {
    return this.db.withTenant(p.tenantId, async (q) => {
      const r = await q.query(
        `SELECT DISTINCT ON (user_id) user_id, ST_Y(coordinates::geometry) AS lat, ST_X(coordinates::geometry) AS lng, accuracy_meters, recorded_at
         FROM geo.location_point WHERE group_id = $1
         ORDER BY user_id, recorded_at DESC`,
        [groupId],
      );
      return r.rows;
    });
  }
}

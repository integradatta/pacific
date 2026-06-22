import { ForbiddenException, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { evaluateGeofence, isWithinSchedule, type AlertType, type GeofenceEventType, type LatLng, type Schedule } from '@pacific/geo-shared';
import { GEO_DB, type GeoDb, type Querier } from '../../common/geo-db.js';
import type { Principal } from '../../common/principal.js';

export const MAX_GEOFENCES_PER_GROUP = 20;

export interface CreateGeofenceInput {
  name: string;
  center: LatLng;
  radiusMeters: number;
  alertType: AlertType;
  monitoredMembers?: string[];
  schedule?: Schedule | null;
}

interface DetectedEvent { geofenceId: string; eventType: GeofenceEventType; }

@Injectable()
export class GeofencingService {
  constructor(@Inject(GEO_DB) private readonly db: GeoDb) {}

  async create(p: Principal, groupId: string, input: CreateGeofenceInput): Promise<{ id: string }> {
    return this.db.withTenant(p.tenantId, async (q) => {
      await this.requireAdmin(q, groupId, p.userId);
      const count = await q.query<{ n: string }>(
        `SELECT count(*)::int AS n FROM geo.geofence WHERE group_id = $1`,
        [groupId],
      );
      if (Number(count.rows[0]?.n ?? 0) >= MAX_GEOFENCES_PER_GROUP) {
        throw new HttpException(`Máximo de ${MAX_GEOFENCES_PER_GROUP} geofences por grupo.`, HttpStatus.CONFLICT);
      }
      const r = await q.query<{ id: string }>(
        `INSERT INTO geo.geofence(group_id, tenant_id, name, center, radius_meters, alert_type, monitored_members, schedule, created_by)
         VALUES ($1,$2,$3, ST_SetSRID(ST_MakePoint($4,$5),4326)::geography, $6, $7, $8, $9, $10) RETURNING id`,
        [groupId, p.tenantId, input.name, input.center.lng, input.center.lat, input.radiusMeters, input.alertType, input.monitoredMembers ?? [], input.schedule ?? null, p.userId],
      );
      return { id: r.rows[0]!.id };
    });
  }

  async list(p: Principal, groupId: string) {
    return this.db.withTenant(p.tenantId, async (q) => {
      const r = await q.query(
        `SELECT id, name, radius_meters, alert_type, monitored_members, schedule, is_active,
                ST_Y(center::geometry) AS lat, ST_X(center::geometry) AS lng
         FROM geo.geofence WHERE group_id = $1 ORDER BY created_at DESC`,
        [groupId],
      );
      return r.rows;
    });
  }

  async remove(p: Principal, groupId: string, geofenceId: string): Promise<void> {
    return this.db.withTenant(p.tenantId, async (q) => {
      await this.requireAdmin(q, groupId, p.userId);
      await q.query(`DELETE FROM geo.geofence WHERE id = $1 AND group_id = $2`, [geofenceId, groupId]);
    });
  }

  /**
   * Detecção por ponto (chamada dentro da transação do ingest). Usa ST_Distance (PostGIS) +
   * a lógica pura testada (evaluateGeofence/isWithinSchedule). Persiste geofence_event nas transições.
   */
  async detectForPoint(q: Querier, tenantId: string, groupId: string, userId: string, point: LatLng, recordedAt: Date): Promise<DetectedEvent[]> {
    const fences = await q.query<{ id: string; radius_meters: number; alert_type: AlertType; monitored_members: string[]; schedule: Schedule | null; distance: number }>(
      `SELECT id, radius_meters, alert_type, monitored_members, schedule,
              ST_Distance(center, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography) AS distance
       FROM geo.geofence WHERE group_id = $3 AND is_active = true`,
      [point.lng, point.lat, groupId],
    );
    const jsDay = recordedAt.getUTCDay();
    const isoWeekday = jsDay === 0 ? 7 : jsDay;
    const minutesOfDay = recordedAt.getUTCHours() * 60 + recordedAt.getUTCMinutes();
    const out: DetectedEvent[] = [];

    for (const f of fences.rows) {
      if (f.monitored_members.length > 0 && !f.monitored_members.includes(userId)) continue;
      const last = await q.query<{ event_type: GeofenceEventType }>(
        `SELECT event_type FROM geo.geofence_event WHERE geofence_id = $1 AND user_id = $2 ORDER BY occurred_at DESC LIMIT 1`,
        [f.id, userId],
      );
      const prevInside = last.rowCount === 0 ? null : last.rows[0]!.event_type === 'enter';
      const { event } = evaluateGeofence(f.distance, f.radius_meters, prevInside);
      if (!event) continue;
      if (!isWithinSchedule(isoWeekday, minutesOfDay, f.schedule)) continue;
      const wanted = f.alert_type === 'both' || (f.alert_type === 'on_enter' && event === 'enter') || (f.alert_type === 'on_exit' && event === 'exit');
      if (!wanted) continue;
      await q.query(
        `INSERT INTO geo.geofence_event(geofence_id, user_id, tenant_id, event_type, coordinates, occurred_at)
         VALUES ($1,$2,$3,$4, ST_SetSRID(ST_MakePoint($5,$6),4326)::geography, $7)`,
        [f.id, userId, tenantId, event, point.lng, point.lat, recordedAt.toISOString()],
      );
      out.push({ geofenceId: f.id, eventType: event });
    }
    return out;
  }

  private async requireAdmin(q: Querier, groupId: string, userId: string): Promise<void> {
    const r = await q.query<{ role: string }>(
      `SELECT role FROM geo.group_member WHERE group_id = $1 AND user_id = $2 AND status = 'active'`,
      [groupId, userId],
    );
    if (r.rowCount === 0 || r.rows[0]!.role !== 'admin') {
      throw new ForbiddenException('Apenas administradores do grupo podem gerenciar geofences.');
    }
  }
}

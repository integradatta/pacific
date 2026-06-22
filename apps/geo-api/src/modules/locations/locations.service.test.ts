import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { LocationsService } from './locations.service.js';
import type { GeoDb, Querier } from '../../common/geo-db.js';
import type { GeofencingService } from '../geofencing/geofencing.service.js';
import type { IncomingPoint } from '@pacific/geo-shared';
import { NoopRealtime } from '../../realtime/realtime.js';
import type { NotificationsService } from '../../notifications/notifications.service.js';
const noopNotif = { notifyStatusChange: async () => {}, notifyGeofence: async () => {} } as unknown as NotificationsService;

const P = { userId: 'u1', tenantId: 't1', roles: [] };
const NOW = new Date('2026-06-22T12:00:00Z');
const goodPoint: IncomingPoint = { lat: -23.55, lng: -46.63, accuracyMeters: 12, source: 'gps', recordedAt: '2026-06-22T11:59:30Z' };

const fakeGeofencing = { detectForPoint: vi.fn(async () => []) } as unknown as GeofencingService;

function mkDb(opts: { sharingGroups: string[] }) {
  const inserts: string[] = [];
  const q: Querier = {
    query: vi.fn(async (sql: string) => {
      if (sql.includes("FROM geo.group_member WHERE user_id") && sql.includes("sharing_status = 'active'")) {
        return { rows: opts.sharingGroups.map((g) => ({ group_id: g })) as never[], rowCount: opts.sharingGroups.length };
      }
      if (sql.includes('ORDER BY recorded_at DESC LIMIT 1')) return { rows: [] as never[], rowCount: 0 }; // sem prev
      if (sql.includes('INSERT INTO geo.location_point')) inserts.push(sql);
      return { rows: [] as never[], rowCount: 0 };
    }),
  };
  const db: GeoDb = { withTenant: async (_t, fn) => fn(q), adminQuery: async () => ({ rows: [], rowCount: 0 }) };
  return { db, inserts };
}
const svc = (db: GeoDb) => new LocationsService(db, fakeGeofencing, new NoopRealtime(), noopNotif);

describe('LocationsService.ingest', () => {
  it('403 se não há compartilhamento ativo em nenhum grupo', async () => {
    const { db } = mkDb({ sharingGroups: [] });
    await expect(svc(db).ingest(P, 'dev1', goodPoint, NOW)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('rejeita ponto com accuracy ruim (sem inserir)', async () => {
    const { db, inserts } = mkDb({ sharingGroups: ['g1'] });
    const r = await svc(db).ingest(P, 'dev1', { ...goodPoint, accuracyMeters: 600 }, NOW);
    expect(r).toMatchObject({ accepted: false, reason: 'low_accuracy' });
    expect(inserts).toHaveLength(0);
  });
  it('aceita ponto bom e grava em cada grupo ativo', async () => {
    const { db, inserts } = mkDb({ sharingGroups: ['g1', 'g2'] });
    const r = await svc(db).ingest(P, 'dev1', goodPoint, NOW);
    expect(r.accepted).toBe(true);
    expect(r.groups).toBe(2);
    expect(inserts).toHaveLength(2);
    expect(fakeGeofencing.detectForPoint).toHaveBeenCalled();
  });
});

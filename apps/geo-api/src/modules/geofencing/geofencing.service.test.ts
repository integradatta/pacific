import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException, HttpException } from '@nestjs/common';
import { GeofencingService, MAX_GEOFENCES_PER_GROUP } from './geofencing.service.js';
import type { GeoDb, Querier } from '../../common/geo-db.js';

const P = { userId: 'u1', tenantId: 't1', roles: [] };
const input = { name: 'Escola', center: { lat: -23.5, lng: -46.6 }, radiusMeters: 200, alertType: 'both' as const };

function mkDb(opts: { role: string; count: number }) {
  const q: Querier = {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('SELECT role FROM geo.group_member')) return { rows: [{ role: opts.role }] as never[], rowCount: 1 };
      if (sql.includes('count(*)::int AS n FROM geo.geofence')) return { rows: [{ n: opts.count }] as never[], rowCount: 1 };
      if (sql.includes('INSERT INTO geo.geofence')) return { rows: [{ id: 'gf1' }] as never[], rowCount: 1 };
      return { rows: [] as never[], rowCount: 0 };
    }),
  };
  const db: GeoDb = { withTenant: async (_t, fn) => fn(q) };
  return db;
}
const svc = (db: GeoDb) => new GeofencingService(db);

describe('GeofencingService.create', () => {
  it('só admin cria geofence (403 caso contrário)', async () => {
    await expect(svc(mkDb({ role: 'participant', count: 0 })).create(P, 'g1', input)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('bloqueia ao atingir o máximo de geofences (409)', async () => {
    const err = await svc(mkDb({ role: 'admin', count: MAX_GEOFENCES_PER_GROUP })).create(P, 'g1', input).catch((e) => e);
    expect((err as HttpException).getStatus()).toBe(409);
  });
  it('cria quando admin e abaixo do limite', async () => {
    const out = await svc(mkDb({ role: 'admin', count: 3 })).create(P, 'g1', input);
    expect(out.id).toBe('gf1');
  });
});

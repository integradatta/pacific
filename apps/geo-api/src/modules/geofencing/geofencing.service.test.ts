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
  const db: GeoDb = { withTenant: async (_t, fn) => fn(q), adminQuery: async () => ({ rows: [], rowCount: 0 }) };
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

describe('GeofencingService.detectForPoint', () => {
  const NOW = new Date('2026-06-22T12:00:00Z'); // quarta, 12:00 UTC
  // q com 1 geofence (raio 1000m, distância configurável), último evento e captura de INSERTs.
  function detectQ(opts: { distance: number; alertType?: string; lastEvent?: string | null; monitored?: string[]; schedule?: unknown }) {
    const inserts: unknown[][] = [];
    const q: Querier = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        if (sql.includes('FROM geo.geofence WHERE group_id')) {
          return { rows: [{ id: 'gf1', name: 'Escola', radius_meters: 1000, alert_type: opts.alertType ?? 'both', monitored_members: opts.monitored ?? [], schedule: opts.schedule ?? null, distance: opts.distance }] as never[], rowCount: 1 };
        }
        if (sql.includes('FROM geo.geofence_event')) {
          return { rows: (opts.lastEvent ? [{ event_type: opts.lastEvent }] : []) as never[], rowCount: opts.lastEvent ? 1 : 0 };
        }
        if (sql.includes('INSERT INTO geo.geofence_event')) inserts.push(params);
        return { rows: [] as never[], rowCount: 0 };
      }),
    };
    const db: GeoDb = { withTenant: async (_t, fn) => fn(q), adminQuery: async () => ({ rows: [], rowCount: 0 }) };
    return { q, db, inserts };
  }
  const run = (h: ReturnType<typeof detectQ>) =>
    new GeofencingService(h.db).detectForPoint(h.q, 't1', 'g1', 'u1', { lat: -23.5, lng: -46.6 }, NOW);

  it('gera "enter" ao cruzar para dentro (estava fora) e grava evento', async () => {
    const h = detectQ({ distance: 700, lastEvent: 'exit' });
    const events = await run(h);
    expect(events).toEqual([{ geofenceId: 'gf1', geofenceName: 'Escola', eventType: 'enter' }]);
    expect(h.inserts).toHaveLength(1);
  });
  it('banda morta (histerese) não gera evento', async () => {
    const events = await run(detectQ({ distance: 1000, lastEvent: 'exit' }));
    expect(events).toHaveLength(0);
  });
  it('respeita monitored_members (usuário fora da lista é ignorado)', async () => {
    const events = await run(detectQ({ distance: 700, lastEvent: 'exit', monitored: ['outro'] }));
    expect(events).toHaveLength(0);
  });
  it('respeita alert_type (on_exit não dispara em entrada)', async () => {
    const events = await run(detectQ({ distance: 700, lastEvent: 'exit', alertType: 'on_exit' }));
    expect(events).toHaveLength(0);
  });
  it('fora da janela de horário não dispara', async () => {
    const events = await run(detectQ({ distance: 700, lastEvent: 'exit', schedule: { days: [3], start: '20:00', end: '23:00' } }));
    expect(events).toHaveLength(0); // 12:00 fora de 20–23h
  });
});

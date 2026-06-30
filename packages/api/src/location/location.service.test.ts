import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { LocationService } from './location.service.js';

function fakeDb(over: Record<string, unknown> = {}) {
  return {
    locationConsent: {
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(async () => ({})),
      findMany: vi.fn(async () => []),
    },
    debtorPosition: {
      findUnique: vi.fn(async () => null),
      updateMany: vi.fn(async () => ({ count: 0 })),
      create: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 0 })),
      findMany: vi.fn(async () => []),
    },
    locationPing: { createMany: vi.fn(async () => ({ count: 0 })), findMany: vi.fn(async () => []), deleteMany: vi.fn(async () => ({ count: 0 })) },
    geofence: { findMany: vi.fn(async () => []), create: vi.fn(async () => ({})), deleteMany: vi.fn(async () => ({ count: 0 })) },
    geofenceEvent: { createMany: vi.fn(async () => ({ count: 0 })) },
    debtor: { findMany: vi.fn(async () => []) },
    ...over,
  };
}
const tracking = { record: vi.fn(async () => undefined) };
const svc = (db: ReturnType<typeof fakeDb>) =>
  new LocationService({ withTenant: async (_t: string, fn: (tx: typeof db) => unknown) => fn(db) } as never, tracking as never);

describe('LocationService — consentimento', () => {
  it('setConsent GRANTED faz upsert com grantedAt e registra o tracking', async () => {
    const db = fakeDb();
    await svc(db).setConsent('t1', 'd1', 'GRANTED', 'v1');
    expect(db.locationConsent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { debtorId: 'd1' },
      create: expect.objectContaining({ debtorId: 'd1', tenantId: 't1', state: 'GRANTED', consentText: 'v1' }),
    }));
    expect(tracking.record).toHaveBeenCalledWith(db, expect.objectContaining({ type: 'LOCATION_CONSENT', detail: { state: 'GRANTED' } }));
  });

  it('setConsent REVOKED apaga a última posição', async () => {
    const db = fakeDb();
    await svc(db).setConsent('t1', 'd1', 'REVOKED');
    expect(db.debtorPosition.deleteMany).toHaveBeenCalledWith({ where: { tenantId: 't1', debtorId: 'd1' } });
  });

  it('setConsent DECLINED registra recusa (gatilho da notificação)', async () => {
    const db = fakeDb();
    await svc(db).setConsent('t1', 'd1', 'DECLINED');
    expect(tracking.record).toHaveBeenCalledWith(db, expect.objectContaining({ type: 'LOCATION_CONSENT', detail: { state: 'DECLINED' } }));
  });
});

describe('LocationService — pings', () => {
  const pts = [{ lat: -23.5, lng: -46.6, recordedAt: '2026-06-30T12:00:00Z' }];
  it('recusa pings se não estiver GRANTED', async () => {
    const db = fakeDb();
    db.locationConsent.findUnique = vi.fn(async () => ({ state: 'REVOKED' })) as never;
    await expect(svc(db).recordPings('t1', 'd1', pts)).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.locationPing.createMany).not.toHaveBeenCalled();
  });

  const NOW = new Date('2026-06-30T12:10:00Z');
  it('aceita pings quando GRANTED: grava histórico + cria a última posição (mais recente)', async () => {
    const db = fakeDb();
    db.locationConsent.findUnique = vi.fn(async () => ({ state: 'GRANTED' })) as never; // prev null → create
    const out = await svc(db).recordPings('t1', 'd1', [
      { lat: -23.5, lng: -46.6, recordedAt: '2026-06-30T12:00:00Z' },
      { lat: -23.6, lng: -46.7, recordedAt: '2026-06-30T12:05:00Z' },
    ], NOW);
    expect(out.accepted).toBe(2);
    expect(db.locationPing.createMany).toHaveBeenCalled();
    expect(db.debtorPosition.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ lat: -23.6, lng: -46.7 }) }));
  });

  it('descarta pings com timestamp no futuro (não envenena a posição)', async () => {
    const db = fakeDb();
    db.locationConsent.findUnique = vi.fn(async () => ({ state: 'GRANTED' })) as never;
    const out = await svc(db).recordPings('t1', 'd1', [{ lat: -23.5, lng: -46.6, recordedAt: '2026-06-30T12:30:00Z' }], NOW); // +20min > skew
    expect(out.accepted).toBe(0);
    expect(db.locationPing.createMany).not.toHaveBeenCalled();
  });

  it('não regride a última posição com lote mais antigo (updateMany condicional, sem create)', async () => {
    const db = fakeDb();
    db.locationConsent.findUnique = vi.fn(async () => ({ state: 'GRANTED' })) as never;
    db.debtorPosition.findUnique = vi.fn(async () => ({ lat: 1, lng: 1, recordedAt: new Date('2026-06-30T12:09:00Z') })) as never; // já existe, recente
    db.debtorPosition.updateMany = vi.fn(async () => ({ count: 0 })) as never; // nada mais antigo → não atualiza
    await svc(db).recordPings('t1', 'd1', [{ lat: -23.5, lng: -46.6, recordedAt: '2026-06-30T12:01:00Z' }], NOW);
    expect(db.debtorPosition.create).not.toHaveBeenCalled(); // não cria/regride
    expect(db.geofenceEvent.createMany).not.toHaveBeenCalled(); // não reavalia geofence
  });

  it('gera ARRIVAL ao entrar numa geofence (posição avançou)', async () => {
    const db = fakeDb();
    db.locationConsent.findUnique = vi.fn(async () => ({ state: 'GRANTED' })) as never;
    db.debtorPosition.findUnique = vi.fn(async () => ({ lat: 0, lng: 0, recordedAt: new Date('2026-06-30T11:00:00Z') })) as never; // longe + antigo
    db.debtorPosition.updateMany = vi.fn(async () => ({ count: 1 })) as never; // avançou
    db.geofence.findMany = vi.fn(async () => [{ id: 'g1', lat: -23.5, lng: -46.6, radiusM: 200 }]) as never;
    await svc(db).recordPings('t1', 'd1', [{ lat: -23.5, lng: -46.6, recordedAt: '2026-06-30T12:00:00Z' }], NOW); // dentro
    expect(db.geofenceEvent.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ geofenceId: 'g1', type: 'ARRIVAL' })] }));
  });
});

describe('LocationService — padrinho', () => {
  it('positions devolve só devedores GRANTED, com nome e flag online', async () => {
    const db = fakeDb();
    db.locationConsent.findMany = vi.fn(async () => [{ debtorId: 'd1' }]) as never;
    db.debtorPosition.findMany = vi.fn(async () => [{ debtorId: 'd1', lat: -23.5, lng: -46.6, accuracy: 10, battery: 80, recordedAt: new Date('2026-06-30T12:00:00Z') }]) as never;
    db.debtor.findMany = vi.fn(async () => [{ id: 'd1', name: 'Cliente A' }]) as never;
    const out = await svc(db).positions('t1', new Date('2026-06-30T12:01:00Z'));
    expect(out).toEqual([expect.objectContaining({ debtorId: 'd1', debtorName: 'Cliente A', lat: -23.5, online: true })]);
  });

  it('declines lista devedores que recusaram', async () => {
    const db = fakeDb();
    db.locationConsent.findMany = vi.fn(async () => [{ debtorId: 'd1', declinedAt: new Date('2026-06-30T10:00:00Z') }]) as never;
    db.debtor.findMany = vi.fn(async () => [{ id: 'd1', name: 'Cliente A' }]) as never;
    const out = await svc(db).declines('t1');
    expect(out).toEqual([{ debtorId: 'd1', debtorName: 'Cliente A', declinedAt: '2026-06-30T10:00:00.000Z' }]);
  });
});

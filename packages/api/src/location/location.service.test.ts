import { describe, it, expect, vi } from 'vitest';
import { LocationService } from './location.service.js';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

const NOW = new Date('2026-06-21T12:00:00Z');
function debtorRow(over: Record<string, unknown> = {}) {
  return { id: 'd1', tenantId: 't1', locationConsent: 'NEVER', locationConsentAt: null, locationRevokedAt: null, ...over };
}
function pingRow(over: Record<string, unknown> = {}) {
  return { debtorId: 'd1', lat: -27.6, lng: -48.5, accuracy: 12, battery: 80, recordedAt: NOW, ...over };
}

function fakeDb() {
  return {
    debtor: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; tenantId: string } }) =>
        where.id === 'd1' && where.tenantId === 't1' ? debtorRow() : null),
      update: vi.fn(async () => ({})),
      findMany: vi.fn(async () => [{ id: 'd1' }]),
    },
    locationPing: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...pingRow(), ...data, recordedAt: data.recordedAt })),
      findFirst: vi.fn(async () => pingRow()),
      findMany: vi.fn(async () => [pingRow(), pingRow({ recordedAt: new Date('2026-06-21T11:00:00Z') })]),
    },
  };
}
const svc = (db: ReturnType<typeof fakeDb>) =>
  new LocationService({ withTenant: async (_t: string, fn: (tx: typeof db) => unknown) => fn(db) } as never);

describe('LocationService', () => {
  it('getConsent mapeia o estado do devedor', async () => {
    const db = fakeDb();
    db.debtor.findFirst = vi.fn(async () => debtorRow({ locationConsent: 'GRANTED', locationConsentAt: NOW })) as never;
    const c = await svc(db).getConsent('t1', 'd1');
    expect(c).toMatchObject({ debtorId: 'd1', state: 'GRANTED' });
    expect(c.grantedAt).toBe(NOW.toISOString());
  });

  it('setConsent(true) concede (GRANTED + grantedAt, revokedAt limpo)', async () => {
    const db = fakeDb();
    await svc(db).setConsent('t1', 'd1', true, NOW);
    expect(db.debtor.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'd1' }, data: { locationConsent: 'GRANTED', locationConsentAt: NOW, locationRevokedAt: null } }),
    );
  });

  it('setConsent(false) revoga (REVOKED + revokedAt)', async () => {
    const db = fakeDb();
    await svc(db).setConsent('t1', 'd1', false, NOW);
    expect(db.debtor.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { locationConsent: 'REVOKED', locationRevokedAt: NOW } }),
    );
  });

  it('recordPing exige consentimento GRANTED', async () => {
    const db = fakeDb(); // NEVER por padrão
    await expect(svc(db).recordPing('t1', 'd1', { lat: -27.6, lng: -48.5 }, NOW)).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.locationPing.create).not.toHaveBeenCalled();
  });

  it('recordPing grava a posição quando consentido e marca online', async () => {
    const db = fakeDb();
    db.debtor.findFirst = vi.fn(async () => debtorRow({ locationConsent: 'GRANTED' })) as never;
    const pos = await svc(db).recordPing('t1', 'd1', { lat: -27.6, lng: -48.5, accuracy: 9, battery: 77 }, NOW);
    expect(db.locationPing.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: 't1', debtorId: 'd1', lat: -27.6, lng: -48.5, recordedAt: NOW }) }),
    );
    expect(pos).toMatchObject({ debtorId: 'd1', online: true });
  });

  it('lastPosition é null quando não há ping', async () => {
    const db = fakeDb(); db.locationPing.findFirst = vi.fn(async () => null) as never;
    expect(await svc(db).lastPosition('t1', 'd1', NOW)).toBeNull();
  });

  it('history filtra por tenant+devedor e respeita limite', async () => {
    const db = fakeDb();
    const rows = await svc(db).history('t1', 'd1', { limit: 50 }, NOW);
    expect(db.locationPing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 't1', debtorId: 'd1' }), take: 50 }),
    );
    expect(rows).toHaveLength(2);
  });

  it('positions só inclui quem está compartilhando (GRANTED) e tem posição', async () => {
    const db = fakeDb();
    db.debtor.findMany = vi.fn(async () => [{ id: 'd1' }, { id: 'd2' }]) as never;
    // d1 tem ping; d2 não
    db.locationPing.findFirst = vi
      .fn()
      .mockResolvedValueOnce(pingRow({ debtorId: 'd1' }))
      .mockResolvedValueOnce(null) as never;
    const positions = await svc(db).positions('t1', NOW);
    expect(db.debtor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1', locationConsent: 'GRANTED' } }),
    );
    expect(positions).toHaveLength(1);
    expect(positions[0]!.debtorId).toBe('d1');
  });

  it('devedor de outro tenant → NotFound', async () => {
    await expect(svc(fakeDb()).getConsent('t2', 'd1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { DebtorsAdminService } from './debtors-admin.service.js';
import { TrackingService } from '../tracking/tracking.service.js';
import { NotFoundException } from '@nestjs/common';

function fakeDb() {
  return {
    debtor: {
      create: vi.fn(async ({ data }: { data: { name: string; tenantId: string } }) => ({ id: 'd1', ...data })),
      findMany: vi.fn(async () => [{ id: 'd1', name: 'Ana', tenantId: 't1', createdAt: new Date() }]),
      count: vi.fn(async () => 1),
    },
    debtorAccess: {
      create: vi.fn(async () => ({ id: 'a1' })),
      updateMany: vi.fn(async () => ({ count: 1 })),
      findMany: vi.fn(async () => [{ debtorId: 'd1', active: true, lastSeenAt: null }]),
    },
    debtorLoginEvent: {
      findMany: vi.fn(async () => [{ id: 'e1', success: true, at: new Date() }]),
      count: vi.fn(async () => 1),
    },
    platformEvent: { create: vi.fn(async () => ({})) },
  };
}
const tracking = new TrackingService({ raw: () => ({}) } as never);
const svc = (db: ReturnType<typeof fakeDb>) =>
  new DebtorsAdminService({ withTenant: async (_t: string, fn: (tx: typeof db) => unknown) => fn(db) } as never, tracking);

describe('DebtorsAdminService', () => {
  it('create: cria devedor + acesso (tokenHash) e devolve link /d/<token> uma vez', async () => {
    const db = fakeDb();
    const out = await svc(db).create('t1', 'Ana');
    expect(db.debtor.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: 't1', name: 'Ana' }) }));
    expect(db.debtorAccess.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ debtorId: 'd1', tenantId: 't1', tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) }) }));
    expect(out.debtorId).toBe('d1');
    expect(out.accessLink).toMatch(/\/d\/[A-Za-z0-9_-]{43}$/);
  });
  it('revoke: desativa o acesso (updateMany com tenantId) ', async () => {
    const db = fakeDb();
    await svc(db).setActive('t1', 'd1', false);
    expect(db.debtorAccess.updateMany).toHaveBeenCalledWith({ where: { debtorId: 'd1', tenantId: 't1' }, data: { active: false } });
  });
  it('revoke: devedor inexistente → NotFound', async () => {
    const db = fakeDb(); db.debtorAccess.updateMany = vi.fn(async () => ({ count: 0 }));
    await expect(svc(db).setActive('t1', 'x', false)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('rotateLink: gera novo link e atualiza tokenHash+rotatedAt', async () => {
    const db = fakeDb();
    const out = await svc(db).rotateLink('t1', 'd1');
    expect(out.accessLink).toMatch(/\/d\/[A-Za-z0-9_-]{43}$/);
    const call = ((db.debtorAccess.updateMany.mock.calls as unknown[][])[0]![0]) as { where: unknown; data: { tokenHash: string; rotatedAt: Date } };
    expect(call.where).toEqual({ debtorId: 'd1', tenantId: 't1' });
    expect(call.data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });
  it('list: mescla nome + active/lastSeenAt do acesso', async () => {
    const page = await svc(fakeDb()).list('t1', { limit: 20, offset: 0 });
    expect(page.total).toBe(1);
    expect(page.items[0]).toMatchObject({ id: 'd1', name: 'Ana', active: true });
  });
  it('logins: filtra por tenantId+debtorId', async () => {
    const db = fakeDb();
    await svc(db).logins('t1', 'd1', { limit: 20, offset: 0 });
    expect(db.debtorLoginEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 't1', debtorId: 'd1' } }));
  });
});

import { describe, it, expect, vi } from 'vitest';
import { TrackingService } from './tracking.service.js';

describe('TrackingService', () => {
  it('record grava no PlatformEvent via tx do caller', async () => {
    const create = vi.fn(async () => ({}));
    const svc = new TrackingService({ raw: () => ({}) } as never);
    await svc.record({ platformEvent: { create } } as never, { tenantId: 't1', actorType: 'CREDITOR', type: 'OPERATION_CREATED', targetId: 'd1' });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: 't1', actorType: 'CREDITOR', type: 'OPERATION_CREATED', targetId: 'd1' }) }));
  });

  it('record é best-effort (não lança se o insert falhar)', async () => {
    const svc = new TrackingService({ raw: () => ({}) } as never);
    const tx = { platformEvent: { create: vi.fn(async () => { throw new Error('db down'); }) } } as never;
    await expect(svc.record(tx, { actorType: 'SYSTEM', type: 'IMPORTANT' })).resolves.toBeUndefined();
  });

  it('list aplica filtros (tipo/tenant) e mapeia', async () => {
    const findMany = vi.fn(async () => [
      { id: 'e1', tenantId: 't1', actorType: 'CREDITOR', actorId: 'u1', type: 'LOGIN', targetType: null, targetId: null, detail: null, at: new Date('2026-06-22T10:00:00Z') },
    ]);
    const svc = new TrackingService({ raw: () => ({ platformEvent: { findMany } }) } as never);
    const rows = await svc.list({ type: 'LOGIN', tenantId: 't1', limit: 50 });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ type: 'LOGIN', tenantId: 't1' }), take: 50 }));
    expect(rows[0]).toMatchObject({ id: 'e1', type: 'LOGIN', actorType: 'CREDITOR' });
  });

  it('recordRaw usa o cliente raw()', async () => {
    const create = vi.fn(async () => ({}));
    const svc = new TrackingService({ raw: () => ({ platformEvent: { create } }) } as never);
    await svc.recordRaw({ actorType: 'CREDITOR', actorId: 'u1', type: 'LOGIN', tenantId: 't1' });
    expect(create).toHaveBeenCalled();
  });
});

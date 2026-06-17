import { describe, it, expect, vi } from 'vitest';
import { DebtsService } from './debts.service.js';
import { NotFoundException } from '@nestjs/common';

function fakeDb() {
  return {
    debtor: { findFirst: vi.fn(async () => ({ id: 'd1', tenantId: 't1' })) },
    debt: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'debt1', ...data })),
      findMany: vi.fn(async () => [{ id: 'debt1' }]),
      count: vi.fn(async () => 1),
      findFirst: vi.fn(async ({ where }: { where: { id: string; tenantId: string } }) =>
        where.id === 'debt1' && where.tenantId === 't1' ? { id: 'debt1', tenantId: 't1' } : null),
    },
  };
}
const svc = (db: ReturnType<typeof fakeDb>) => new DebtsService({ db: () => db } as never);
const base = { principal: '1000.00', rate: '0.030000', ratePeriod: 'MONTHLY' as const, startDate: '2026-05-01T00:00:00Z', dueDate: '2026-07-01T00:00:00Z' };

describe('DebtsService', () => {
  it('create injeta tenantId e valida o devedor do tenant', async () => {
    const db = fakeDb();
    const out = await svc(db).create('t1', { debtorId: 'd1', ...base });
    expect(db.debt.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: 't1', debtorId: 'd1' }) }));
    expect(out.id).toBe('debt1');
  });
  it('create rejeita devedor de outro tenant', async () => {
    const db = fakeDb(); db.debtor.findFirst = vi.fn(async () => null) as never;
    await expect(svc(db).create('t1', { debtorId: 'x', ...base })).rejects.toBeInstanceOf(NotFoundException);
  });
  it('list filtra por tenantId e pagina', async () => {
    const db = fakeDb();
    const page = await svc(db).list('t1', { limit: 20, offset: 0 });
    expect(db.debt.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 't1' }, take: 20, skip: 0 }));
    expect(page.total).toBe(1);
  });
  it('get de outro tenant → NotFound', async () => {
    await expect(svc(fakeDb()).get('t2', 'debt1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { NotificationsService } from './notifications.service.js';
import { NotFoundException } from '@nestjs/common';

const start = new Date('2026-01-01T00:00:00Z');
function debt(id: string, dueDate: Date) {
  return { id, debtorId: `dbt-${id}`, principal: { toString: () => '1000.00' }, rate: { toString: () => '0' }, ratePeriod: 'MONTHLY', startDate: start, dueDate };
}
function fakeDb(debts: ReturnType<typeof debt>[]) {
  return {
    debt: { findMany: vi.fn(async () => debts) },
    notification: {
      upsert: vi.fn(async () => ({})),
      findMany: vi.fn(async () => [{ id: 'n1' }]),
      count: vi.fn(async () => 1),
      findFirst: vi.fn(async ({ where }: { where: { id: string; tenantId: string } }) =>
        where.id === 'n1' && where.tenantId === 't1' ? { id: 'n1', tenantId: 't1' } : null),
      update: vi.fn(async () => ({ id: 'n1', readAt: new Date() })),
    },
  };
}
const svc = (db: ReturnType<typeof fakeDb>) => new NotificationsService({ db: () => db } as never);
const asOf = new Date('2026-02-01T00:00:00Z');

describe('NotificationsService', () => {
  it('gera OVERDUE para vencida, DUE_SOON para <=7 dias, ignora distante', async () => {
    const db = fakeDb([
      debt('a', new Date('2026-01-20T00:00:00Z')), // vencida -> OVERDUE
      debt('b', new Date('2026-02-05T00:00:00Z')), // 4 dias -> DUE_SOON
      debt('c', new Date('2026-06-01T00:00:00Z')), // distante -> nada
    ]);
    const out = await svc(db).generateDueNotifications('t1', asOf);
    expect(out.created).toBe(2);
    expect(db.notification.upsert).toHaveBeenCalledTimes(2);
    const calls = db.notification.upsert.mock.calls as unknown as Array<[{ create: { type: string } }]>;
    const types = calls.map((c) => c[0].create.type);
    expect(types.sort()).toEqual(['DUE_SOON', 'OVERDUE']);
  });
  it('list filtra por tenantId e pagina', async () => {
    const db = fakeDb([]);
    const page = await svc(db).list('t1', { limit: 20, offset: 0 });
    expect(db.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 't1' }, take: 20, skip: 0 }));
    expect(page.total).toBe(1);
  });
  it('markRead de outro tenant → NotFound', async () => {
    await expect(svc(fakeDb([])).markRead('t2', 'n1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

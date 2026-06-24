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
const svc = (db: ReturnType<typeof fakeDb>) =>
  new NotificationsService({ withTenant: async (_t: string, fn: (tx: typeof db) => unknown) => fn(db) } as never);
const asOf = new Date('2026-02-01T00:00:00Z');

describe('NotificationsService', () => {
  const typesOf = (db: ReturnType<typeof fakeDb>): string[] =>
    (db.notification.upsert.mock.calls as unknown as Array<[{ create: { type: string } }]>).map((c) => c[0].create.type);

  it('gera a régua correta por dias até o vencimento (15/7/3/1/0/atraso)', async () => {
    const db = fakeDb([
      debt('a', new Date('2026-01-20T00:00:00Z')), // -12 -> OVERDUE
      debt('b', new Date('2026-02-01T00:00:00Z')), //   0 -> DUE_TODAY
      debt('g', new Date('2026-02-02T00:00:00Z')), //   1 -> DUE_1
      debt('c', new Date('2026-02-03T00:00:00Z')), //   2 -> DUE_3
      debt('d', new Date('2026-02-06T00:00:00Z')), //   5 -> DUE_7
      debt('e', new Date('2026-02-12T00:00:00Z')), //  11 -> DUE_15
      debt('f', new Date('2026-06-01T00:00:00Z')), // distante -> nada
    ]);
    const out = await svc(db).generateDueNotifications('t1', undefined, asOf);
    expect(out.created).toBe(6);
    expect(typesOf(db).sort()).toEqual(['DUE_1', 'DUE_15', 'DUE_3', 'DUE_7', 'DUE_TODAY', 'OVERDUE']);
  });

  it('respeita as réguas ativas (enabled filtra)', async () => {
    const db = fakeDb([
      debt('a', new Date('2026-01-20T00:00:00Z')), // OVERDUE
      debt('b', new Date('2026-02-06T00:00:00Z')), // DUE_7
    ]);
    const out = await svc(db).generateDueNotifications('t1', ['OVERDUE'], asOf);
    expect(out.created).toBe(1);
    expect(typesOf(db)).toEqual(['OVERDUE']);
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

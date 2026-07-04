import { describe, it, expect, vi } from 'vitest';
import { NotificationsService, dueNotificationRows } from './notifications.service.js';
import { ALERT_TYPES, type AlertType } from './dto/generate-alerts.dto.js';
import { NotFoundException } from '@nestjs/common';

const start = new Date('2026-01-01T00:00:00Z');
function debt(id: string, dueDate: Date, settledAt: Date | null = null) {
  return { id, debtorId: `dbt-${id}`, principal: { toString: () => '1000.00' }, rate: { toString: () => '0' }, ratePeriod: 'MONTHLY', startDate: start, dueDate, settledAt };
}
function fakeDb(debts: ReturnType<typeof debt>[]) {
  return {
    // INSERT set-based das notificações de vencimento (era N upserts).
    $executeRaw: vi.fn(async () => debts.length),
    // Honra o filtro settledAt:null (só dívidas abertas geram alerta).
    debt: { findMany: vi.fn(async (args?: { where?: { settledAt?: unknown } }) =>
      args?.where && 'settledAt' in args.where ? debts.filter((d) => d.settledAt == null) : debts) },
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
  const typesOfRows = (debts: ReturnType<typeof debt>[], active = new Set(ALERT_TYPES)): string[] =>
    dueNotificationRows(debts as never, active, asOf).map((r) => r.type);

  it('gera a régua correta por dias até o vencimento (15/7/3/1/0/atraso)', async () => {
    const debts = [
      debt('a', new Date('2026-01-20T00:00:00Z')), // -12 -> OVERDUE
      debt('b', new Date('2026-02-01T00:00:00Z')), //   0 -> DUE_TODAY
      debt('g', new Date('2026-02-02T00:00:00Z')), //   1 -> DUE_1
      debt('c', new Date('2026-02-03T00:00:00Z')), //   2 -> DUE_3
      debt('d', new Date('2026-02-06T00:00:00Z')), //   5 -> DUE_7
      debt('e', new Date('2026-02-12T00:00:00Z')), //  11 -> DUE_15
      debt('f', new Date('2026-06-01T00:00:00Z')), // distante -> nada
    ];
    // Lógica de régua (pura):
    expect(typesOfRows(debts).sort()).toEqual(['DUE_1', 'DUE_15', 'DUE_3', 'DUE_7', 'DUE_TODAY', 'OVERDUE']);
    // Integração: uma única INSERT set-based e a contagem certa.
    const db = fakeDb(debts);
    const out = await svc(db).generateDueNotifications('t1', undefined, asOf);
    expect(out.created).toBe(6);
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('NÃO gera alerta para dívida quitada (mesmo vencida) e não faz INSERT quando vazio', async () => {
    const db = fakeDb([
      debt('a', new Date('2026-01-20T00:00:00Z')), // aberta, vencida -> OVERDUE
      debt('paga', new Date('2026-01-20T00:00:00Z'), new Date('2026-01-25T00:00:00Z')), // quitada -> ignora
    ]);
    const out = await svc(db).generateDueNotifications('t1', undefined, asOf);
    expect(out.created).toBe(1); // só a aberta

    const empty = fakeDb([debt('x', new Date('2026-06-01T00:00:00Z'))]); // distante -> nenhuma régua
    const out2 = await svc(empty).generateDueNotifications('t1', undefined, asOf);
    expect(out2.created).toBe(0);
    expect(empty.$executeRaw).not.toHaveBeenCalled(); // nada a inserir → sem query
  });

  it('respeita as réguas ativas (enabled filtra)', async () => {
    const debts = [
      debt('a', new Date('2026-01-20T00:00:00Z')), // OVERDUE
      debt('b', new Date('2026-02-06T00:00:00Z')), // DUE_7
    ];
    expect(typesOfRows(debts, new Set<AlertType>(['OVERDUE']))).toEqual(['OVERDUE']);
    const out = await svc(fakeDb(debts)).generateDueNotifications('t1', ['OVERDUE'], asOf);
    expect(out.created).toBe(1);
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

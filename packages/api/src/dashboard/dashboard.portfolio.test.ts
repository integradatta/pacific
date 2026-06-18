import { describe, it, expect, vi } from 'vitest';
import { DashboardService } from './dashboard.service.js';

const start = new Date('2026-01-01T00:00:00Z');
function pfDebt(id: string, name: string, dueDate: Date, rate = '0', principal = '1000.00') {
  return { id, principal: { toString: () => principal }, rate: { toString: () => rate }, ratePeriod: 'MONTHLY', startDate: start, dueDate, debtor: { name } };
}
function pfDb(debts: ReturnType<typeof pfDebt>[]) {
  return { debt: { findMany: vi.fn(async () => debts) } };
}
const svc = (db: ReturnType<typeof pfDb>) =>
  new DashboardService({ withTenant: async (_t: string, fn: (tx: typeof db) => unknown) => fn(db) } as never);

describe('DashboardService.portfolio', () => {
  it('mapeia dívidas para linhas com status/dias/saldo + nome do devedor', async () => {
    const db = pfDb([
      pfDebt('a', 'Ana Souza', new Date('2026-01-20T00:00:00Z')),  // vencida -> RED
      pfDebt('b', 'Bruno Lima', new Date('2026-06-01T00:00:00Z')), // distante -> GREEN
    ]);
    const rows = await svc(db).portfolio('t1', new Date('2026-02-01T00:00:00Z'));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: 'a', debtorName: 'Ana Souza', status: 'RED', balance: '1000.00' });
    expect(rows[0]!.daysRemaining).toBeLessThan(0);
    expect(rows[1]).toMatchObject({ debtorName: 'Bruno Lima', status: 'GREEN' });
  });
  it('filtra por tenantId', async () => {
    const db = pfDb([]);
    await svc(db).portfolio('t9', new Date('2026-02-01T00:00:00Z'));
    expect(db.debt.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 't9' } }));
  });
});

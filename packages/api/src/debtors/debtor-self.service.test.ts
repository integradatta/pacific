import { describe, it, expect, vi } from 'vitest';
import { DebtorSelfService } from './debtor-self.service.js';

const start = new Date('2026-01-01T00:00:00Z');
function fakeDb(debts: Array<{ id: string }>) {
  return { debt: { findMany: vi.fn(async () => debts.map((d) => ({
    id: d.id, debtorId: 'me', tenantId: 't1',
    principal: { toString: () => '1000.00' }, rate: { toString: () => '0' }, ratePeriod: 'MONTHLY',
    startDate: start, dueDate: new Date('2026-06-01T00:00:00Z'),
  }))) } };
}
const svc = (db: ReturnType<typeof fakeDb>) =>
  new DebtorSelfService({ withTenant: async (_t: string, fn: (tx: typeof db) => unknown) => fn(db) } as never);

describe('DebtorSelfService.myDebts', () => {
  it('retorna as dívidas do próprio devedor com summary, escopado por tenant+debtor', async () => {
    const db = fakeDb([{ id: 'debt1' }]);
    const out = await svc(db).myDebts('t1', 'me');
    expect(db.debt.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 't1', debtorId: 'me' } }));
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe('debt1');
    expect(out[0]!.summary.balance).toBe('1000.00');
    expect(typeof out[0]!.summary.status).toBe('string');
  });
});

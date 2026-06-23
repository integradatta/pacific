import { describe, it, expect, vi } from 'vitest';
import { DebtorSelfService } from './debtor-self.service.js';

const start = new Date('2026-01-01T00:00:00Z');
const dec = (v: string) => ({ toString: () => v, toFixed: () => Number(v).toFixed(2) });
function fakeDb(debts: Array<{ id: string }>, payEvents: Array<{ targetId: string; at: Date; detail: unknown }> = []) {
  return {
    debt: {
      findMany: vi.fn(async () =>
        debts.map((d) => ({
          id: d.id, debtorId: 'me', tenantId: 't1',
          principal: dec('1000.00'), rate: dec('0'), ratePeriod: 'MONTHLY',
          startDate: start, dueDate: new Date('2026-06-01T00:00:00Z'),
          paidAmount: dec('0'), settledAt: null,
        })),
      ),
    },
    platformEvent: { findMany: vi.fn(async () => payEvents) },
  };
}
const svc = (db: ReturnType<typeof fakeDb>) =>
  new DebtorSelfService({ withTenant: async (_t: string, fn: (tx: typeof db) => unknown) => fn(db) } as never);

describe('DebtorSelfService.myDebts', () => {
  it('retorna as dívidas do próprio devedor com summary + principal, escopado por tenant+debtor', async () => {
    const db = fakeDb([{ id: 'debt1' }]);
    const out = await svc(db).myDebts('t1', 'me');
    expect(db.debt.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 't1', debtorId: 'me' } }));
    expect(out).toHaveLength(1);
    expect(out[0]!).toMatchObject({ id: 'debt1', principal: '1000.00' });
    expect(out[0]!.summary.balance).toBe('1000.00');
    expect(out[0]!.payments).toEqual([]);
  });

  it('inclui o histórico de pagamentos (eventos OPERATION_PAID) por dívida', async () => {
    const db = fakeDb([{ id: 'debt1' }], [
      { targetId: 'debt1', at: new Date('2026-03-01T00:00:00Z'), detail: { paidAmount: '300.00' } },
      { targetId: 'debt1', at: new Date('2026-04-01T00:00:00Z'), detail: { paidAmount: '500.00' } },
    ]);
    const out = await svc(db).myDebts('t1', 'me');
    expect(db.platformEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: 'OPERATION_PAID', targetType: 'debt' }) }),
    );
    expect(out[0]!.payments).toEqual([
      { at: '2026-03-01T00:00:00.000Z', total: '300.00' },
      { at: '2026-04-01T00:00:00.000Z', total: '500.00' },
    ]);
  });
});

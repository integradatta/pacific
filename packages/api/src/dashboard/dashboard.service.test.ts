import { describe, it, expect, vi } from 'vitest';
import { DashboardService } from './dashboard.service.js';

const farDue = new Date('2026-12-01T00:00:00Z');
const pastDue = new Date('2026-01-10T00:00:00Z');
const start = new Date('2026-01-01T00:00:00Z');

const dec = (v: string) => ({ toString: () => v, toFixed: () => Number(v).toFixed(2) });
type Raw = { principal: string; rate: string; dueDate: Date; paidAmount?: string; settledAt?: Date | null };
function fakeDb(rows?: Raw[]) {
  const base: Raw[] = rows ?? [
    { principal: '1000.00', rate: '0', dueDate: farDue },
    { principal: '2000.00', rate: '0', dueDate: pastDue },
  ];
  return {
    debt: {
      findMany: vi.fn(async () =>
        base.map((d) => ({
          ratePeriod: 'MONTHLY',
          startDate: start,
          ...d,
          principal: dec(d.principal),
          rate: dec(d.rate),
          paidAmount: dec(d.paidAmount ?? '0'),
          settledAt: d.settledAt ?? null,
        })),
      ),
    },
  };
}
const svc = (db: ReturnType<typeof fakeDb>) =>
  new DashboardService({ withTenant: async (_t: string, fn: (tx: typeof db) => unknown) => fn(db) } as never);

describe('DashboardService.kpis', () => {
  it('agrega carteira com saldos e status (asOf fixo)', async () => {
    const out = await svc(fakeDb()).kpis('t1', new Date('2026-02-01T00:00:00Z'));
    expect(out.totalLent).toBe('3000.00');
    expect(out.totalReceivable).toBe('3000.00'); // rate 0 ⇒ saldo = principal
    expect(out.totalOverdue).toBe('2000.00');     // a 2ª está vencida (RED)
    expect(out.countByStatus).toEqual({ GREEN: 1, YELLOW: 0, ORANGE: 0, RED: 1 });
    expect(out.totalExpectedReturn).toBe('3000.00'); // rate 0 ⇒ valor final = principal
    expect(out.countActive).toBe(1);                  // só a 1ª não está vencida
    expect(out.riskDistribution).toEqual({ LOW: 2, MEDIUM: 0, HIGH: 0 }); // rate 0 ⇒ recuperabilidade alta
  });
  it('filtra por tenantId no findMany', async () => {
    const db = fakeDb();
    await svc(db).kpis('t9', new Date('2026-02-01T00:00:00Z'));
    expect(db.debt.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 't9' } }));
  });
  it('quitada sai de a receber/contagens e entra em recebido + countSettled', async () => {
    const db = fakeDb([
      { principal: '1000.00', rate: '0', dueDate: farDue },
      { principal: '2000.00', rate: '0', dueDate: pastDue, paidAmount: '2000.00', settledAt: start },
    ]);
    const out = await svc(db).kpis('t1', new Date('2026-02-01T00:00:00Z'));
    expect(out.totalLent).toBe('3000.00');       // empréstimo total não muda
    expect(out.totalReceivable).toBe('1000.00'); // só a 1ª (a 2ª foi quitada)
    expect(out.totalOverdue).toBe('0.00');        // a vencida foi quitada
    expect(out.totalReceived).toBe('2000.00');
    expect(out.countSettled).toBe(1);
    expect(out.countByStatus).toEqual({ GREEN: 1, YELLOW: 0, ORANGE: 0, RED: 0 });
  });
  it('pagamento parcial abate o a receber/vencido', async () => {
    const db = fakeDb([{ principal: '2000.00', rate: '0', dueDate: pastDue, paidAmount: '500.00' }]);
    const out = await svc(db).kpis('t1', new Date('2026-02-01T00:00:00Z'));
    expect(out.totalReceivable).toBe('1500.00');
    expect(out.totalOverdue).toBe('1500.00');
    expect(out.totalReceived).toBe('500.00');
  });
});

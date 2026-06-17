import { describe, it, expect, vi } from 'vitest';
import { DashboardService } from './dashboard.service.js';

const farDue = new Date('2026-12-01T00:00:00Z');
const pastDue = new Date('2026-01-10T00:00:00Z');
const start = new Date('2026-01-01T00:00:00Z');

function fakeDb() {
  return {
    debt: {
      findMany: vi.fn(async () => [
        { principal: '1000.00', rate: '0', ratePeriod: 'MONTHLY', startDate: start, dueDate: farDue },
        { principal: '2000.00', rate: '0', ratePeriod: 'MONTHLY', startDate: start, dueDate: pastDue },
      ].map((d) => ({ ...d, principal: { toString: () => d.principal }, rate: { toString: () => d.rate } }))),
    },
  };
}
const svc = (db: ReturnType<typeof fakeDb>) => new DashboardService({ db: () => db } as never);

describe('DashboardService.kpis', () => {
  it('agrega carteira com saldos e status (asOf fixo)', async () => {
    const out = await svc(fakeDb()).kpis('t1', new Date('2026-02-01T00:00:00Z'));
    expect(out.totalLent).toBe('3000.00');
    expect(out.totalReceivable).toBe('3000.00'); // rate 0 ⇒ saldo = principal
    expect(out.totalOverdue).toBe('2000.00');     // a 2ª está vencida (RED)
    expect(out.countByStatus).toEqual({ GREEN: 1, YELLOW: 0, ORANGE: 0, RED: 1 });
  });
  it('filtra por tenantId no findMany', async () => {
    const db = fakeDb();
    await svc(db).kpis('t9', new Date('2026-02-01T00:00:00Z'));
    expect(db.debt.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 't9' } }));
  });
});

import { describe, it, expect, vi } from 'vitest';
import { ReportsService, monthKey } from './reports.service.js';

const dashboard = {
  kpis: vi.fn(async () => ({ totalLent: '1000.00', totalReceivable: '800.00', totalReceived: '200.00', totalOverdue: '100.00', countActive: 3, countSettled: 1 })),
  intelligence: vi.fn(async () => ({ health: { score: 72, state: 'HEALTHY' } })),
};
function fakeDb() {
  return {
    monthlyReport: {
      upsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => ({ ...create, generatedAt: new Date('2026-06-01T05:00:00Z') })),
      findMany: vi.fn(async () => []),
    },
  };
}
const svc = (db: ReturnType<typeof fakeDb>) =>
  new ReportsService({ withTenant: async (_t: string, fn: (tx: typeof db) => unknown) => fn(db), raw: () => db } as never, dashboard as never);

describe('ReportsService (REL-1)', () => {
  it('monthKey formata YYYY-MM', () => {
    expect(monthKey(new Date('2026-06-15T00:00:00Z'))).toBe('2026-06');
  });

  it('generate arquiva os números do mês (upsert idempotente por tenant+mês)', async () => {
    const db = fakeDb();
    const out = await svc(db).generate('t1', '2026-06', new Date('2026-06-01T05:00:00Z'));
    expect(db.monthlyReport.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId_month: { tenantId: 't1', month: '2026-06' } },
      create: expect.objectContaining({ tenantId: 't1', month: '2026-06', totalLent: '1000.00', healthScore: 72, healthState: 'HEALTHY', opsActive: 3, opsSettled: 1 }),
    }));
    expect(out).toMatchObject({ month: '2026-06', totalReceivable: '800.00', healthScore: 72 });
  });

  it('list devolve o histórico mapeado', async () => {
    const db = fakeDb();
    db.monthlyReport.findMany = vi.fn(async () => [
      { month: '2026-05', totalLent: '1.00', totalReceivable: '2.00', totalReceived: '3.00', totalOverdue: '4.00', opsActive: 1, opsSettled: 0, healthScore: 90, healthState: 'HEALTHY', generatedAt: new Date('2026-06-01T00:00:00Z') },
    ]) as never;
    const out = await svc(db).list('t1');
    expect(out[0]).toMatchObject({ month: '2026-05', totalLent: '1.00', healthScore: 90 });
  });
});

import { describe, it, expect, vi } from 'vitest';
import { DashboardService } from './dashboard.service.js';

const start = new Date('2026-01-01T00:00:00Z');
const dec = (v: string) => ({ toString: () => v, toFixed: () => Number(v).toFixed(2) });
function pfDebt(id: string, name: string, dueDate: Date, rate = '0', principal = '1000.00', tags: string[] = [], paidAmount = '0', settledAt: Date | null = null) {
  return { id, principal: dec(principal), rate: dec(rate), ratePeriod: 'MONTHLY', startDate: start, dueDate, tags, paidAmount: dec(paidAmount), settledAt, debtor: { name } };
}
function pfDb(debts: ReturnType<typeof pfDebt>[]) {
  return { debt: { findMany: vi.fn(async () => debts) } };
}
const snapStore = () => ({ portfolioSnapshot: { upsert: vi.fn(async () => ({})), findMany: vi.fn(async () => []) } });
const svc = (db: ReturnType<typeof pfDb>) =>
  new DashboardService({ withTenant: async (_t: string, fn: (tx: typeof db) => unknown) => fn(db), raw: () => snapStore() } as never);

describe('DashboardService.portfolio', () => {
  it('mapeia dívidas para linhas com status/dias/saldo + nome do devedor', async () => {
    const db = pfDb([
      pfDebt('a', 'Ana Souza', new Date('2026-01-20T00:00:00Z'), '0', '1000.00', ['judicial']), // vencida -> RED
      pfDebt('b', 'Bruno Lima', new Date('2026-06-01T00:00:00Z')), // distante -> GREEN
    ]);
    const rows = await svc(db).portfolio('t1', new Date('2026-02-01T00:00:00Z'));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: 'a', debtorName: 'Ana Souza', status: 'RED', balance: '1000.00', amountDue: '1000.00', paidAmount: '0.00', settled: false, principal: '1000.00', tags: ['judicial'] });
    expect(rows[0]!.daysRemaining).toBeLessThan(0);
    expect(rows[1]).toMatchObject({ debtorName: 'Bruno Lima', status: 'GREEN' });
  });
  it('filtra por tenantId', async () => {
    const db = pfDb([]);
    await svc(db).portfolio('t9', new Date('2026-02-01T00:00:00Z'));
    expect(db.debt.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 't9', deletedAt: null } }));
  });

  describe('copilot (IA-1)', () => {
    it('"quem cobrar hoje" lista vencidas/vencendo ≤3d, vencidas primeiro', async () => {
      const db = pfDb([
        pfDebt('a', 'Ana', new Date('2026-01-20T00:00:00Z')), // vencida
        pfDebt('b', 'Bruno', new Date('2026-06-01T00:00:00Z')), // distante
      ]);
      const out = await svc(db).copilot('t1', new Date('2026-02-01T00:00:00Z'));
      expect(out.collectToday.rows.map((r) => r.debtorName)).toEqual(['Ana']);
      expect(out.collectToday.text).toContain('atenção hoje');
    });
    it('carteira vazia → textos amigáveis sem linhas', async () => {
      const out = await svc(pfDb([])).copilot('t1', new Date('2026-02-01T00:00:00Z'));
      expect(out.collectToday.rows).toEqual([]);
      expect(out.summary.text).toContain('não tem operações');
    });
  });
  it('reflete pagamento: parcial abate o devido; quitada zera', async () => {
    const db = pfDb([
      pfDebt('p', 'Parcial', new Date('2026-06-01T00:00:00Z'), '0', '1000.00', [], '400.00'),
      pfDebt('q', 'Quitada', new Date('2026-06-01T00:00:00Z'), '0', '1000.00', [], '1000.00', new Date('2026-02-01T00:00:00Z')),
    ]);
    const rows = await svc(db).portfolio('t1', new Date('2026-02-01T00:00:00Z'));
    expect(rows[0]).toMatchObject({ id: 'p', amountDue: '600.00', paidAmount: '400.00', settled: false });
    expect(rows[1]).toMatchObject({ id: 'q', amountDue: '0.00', settled: true });
  });

  it('intelligence() compõe saúde/resumo/cliente-chave a partir da carteira', async () => {
    const db = pfDb([
      pfDebt('a', 'Ana Souza', new Date('2026-01-20T00:00:00Z'), '0.05', '5000.00'), // vencida
      pfDebt('b', 'Bruno Lima', new Date('2026-06-01T00:00:00Z'), '0.05', '2000.00'),
    ]);
    const intel = await svc(db).intelligence('t1', new Date('2026-02-01T00:00:00Z'));
    expect(intel.summary).toContain('operações ativas');
    expect(['HEALTHY', 'ATTENTION', 'CRITICAL']).toContain(intel.health.state);
    expect(intel.topClient?.name).toBe('Ana Souza'); // maior exposição
    expect(intel.actionItems[0]?.kind).toBe('overdue'); // vencida no topo
  });
});

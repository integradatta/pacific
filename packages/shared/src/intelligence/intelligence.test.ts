import { describe, it, expect } from 'vitest';
import type { PortfolioRow } from '../types/financial.types.js';
import {
  clientAggregates,
  concentration,
  portfolioHealth,
  executiveSummary,
  insights,
  riskReason,
  actionItems,
  rankings,
  portfolioIntelligence,
  currentWeeklyPoint,
  portfolioTrend,
  weeklySummary,
  type WeeklyPoint,
} from './intelligence.js';

// Helper p/ montar uma linha de carteira com defaults sensatos.
function row(p: Partial<PortfolioRow> & { id: string; debtorName: string }): PortfolioRow {
  return {
    principal: '1000.00',
    balance: '1000.00',
    amountDue: '1000.00',
    paidAmount: '0.00',
    expectedReturn: '1100.00',
    settled: false,
    daysRemaining: 30,
    status: 'GREEN',
    recoverability: 90,
    temperature: 10,
    dueDate: '2026-08-01T00:00:00.000Z',
    tags: [],
    ...p,
  };
}

describe('intelligence', () => {
  it('clientAggregates soma exposição e participação por cliente, ordenado', () => {
    const rows = [
      row({ id: '1', debtorName: 'João', amountDue: '6000.00' }),
      row({ id: '2', debtorName: 'João', amountDue: '0.00' }),
      row({ id: '3', debtorName: 'Maria', amountDue: '4000.00' }),
    ];
    const aggs = clientAggregates(rows);
    expect(aggs[0]).toMatchObject({ name: 'João', opsCount: 2, sharePct: 60 });
    expect(aggs[1]).toMatchObject({ name: 'Maria', sharePct: 40 });
  });

  it('concentration calcula top3/5/10', () => {
    const rows = [
      row({ id: '1', debtorName: 'A', amountDue: '5000.00' }),
      row({ id: '2', debtorName: 'B', amountDue: '3000.00' }),
      row({ id: '3', debtorName: 'C', amountDue: '2000.00' }),
    ];
    const c = concentration(rows);
    expect(c.top3Pct).toBe(100);
    expect(c.topClients[0]).toMatchObject({ name: 'A', sharePct: 50 });
  });

  it('portfolioHealth: carteira limpa é saudável; vencidas tornam crítica', () => {
    const clean = portfolioHealth([row({ id: '1', debtorName: 'A' }), row({ id: '2', debtorName: 'B' })]);
    expect(clean.state).toBe('HEALTHY');
    expect(clean.score).toBe(100);

    const bad = portfolioHealth([
      row({ id: '1', debtorName: 'A', status: 'RED', daysRemaining: -10, recoverability: 20 }),
      row({ id: '2', debtorName: 'B', status: 'RED', daysRemaining: -5, recoverability: 10 }),
    ]);
    expect(bad.state).toBe('CRITICAL');
    expect(bad.score).toBeLessThan(40);
    expect(bad.factors.some((f) => f.label === 'Operações vencidas')).toBe(true);
  });

  it('portfolioHealth: carteira vazia (tudo quitado) é saudável sem fatores', () => {
    const h = portfolioHealth([row({ id: '1', debtorName: 'A', settled: true })]);
    expect(h).toEqual({ score: 100, state: 'HEALTHY', factors: [] });
  });

  it('executiveSummary descreve operações, lucro e atenção', () => {
    const s = executiveSummary([
      row({ id: '1', debtorName: 'A', expectedReturn: '1200.00' }),
      row({ id: '2', debtorName: 'B', status: 'RED', daysRemaining: -3, recoverability: 20 }),
    ]);
    expect(s).toContain('2 operações ativas');
    expect(s).toContain('lucro projetado');
    expect(s).toContain('atenção imediata');
  });

  it('riskReason explica o motivo do score', () => {
    expect(riskReason(row({ id: '1', debtorName: 'A', status: 'RED', daysRemaining: -12, recoverability: 20 }))).toMatch(/Alto risco: atraso de 12 dia/);
    expect(riskReason(row({ id: '2', debtorName: 'B', recoverability: 95 }))).toMatch(/Baixo risco/);
  });

  it('insights são gerados e carregam filtro clicável', () => {
    const list = insights([
      row({ id: '1', debtorName: 'João', amountDue: '8000.00', status: 'RED', daysRemaining: -2, recoverability: 15 }),
      row({ id: '2', debtorName: 'Maria', amountDue: '2000.00', daysRemaining: 5, status: 'ORANGE' }),
    ]);
    expect(list.find((i) => i.id === 'overdue')?.filter).toEqual({ kind: 'overdue' });
    expect(list.find((i) => i.id === 'top-client')?.text).toContain('João');
  });

  it('actionItems prioriza vencidas no topo, com motivo', () => {
    const items = actionItems([
      row({ id: '1', debtorName: 'A', daysRemaining: 20 }),
      row({ id: '2', debtorName: 'B', status: 'RED', daysRemaining: -8, recoverability: 30 }),
    ]);
    expect(items[0]).toMatchObject({ kind: 'overdue', opId: '2' });
    expect(items[0].reason).toMatch(/atraso/);
  });

  it('rankings ordena por lucro e por risco', () => {
    const rows = [
      row({ id: '1', debtorName: 'A', principal: '1000.00', expectedReturn: '1500.00', recoverability: 80 }),
      row({ id: '2', debtorName: 'B', principal: '1000.00', expectedReturn: '1100.00', recoverability: 20 }),
    ];
    const r = rankings(rows);
    expect(r.mostProfitable[0].id).toBe('1');
    expect(r.riskiest[0].id).toBe('2');
  });

  it('currentWeeklyPoint deriva saúde/exposição/lucro da semana', () => {
    const p = currentWeeklyPoint([row({ id: '1', debtorName: 'A', amountDue: '5000.00', expectedReturn: '1200.00' })], new Date('2026-06-17T12:00:00Z'));
    expect(p.weekStart).toBe('2026-06-15T00:00:00.000Z'); // segunda-feira da semana
    expect(p.opsActive).toBe(1);
    expect(p.state).toBe('HEALTHY');
  });

  it('portfolioTrend classifica melhora/piora pela variação de saúde', () => {
    const pt = (weekStart: string, healthScore: number): WeeklyPoint => ({ weekStart, healthScore, state: 'HEALTHY', receivable: '0', overdue: '0', expectedProfit: '0', opsActive: 1 });
    expect(portfolioTrend([pt('2026-06-01', 60), pt('2026-06-08', 85)]).direction).toBe('IMPROVING');
    expect(portfolioTrend([pt('2026-06-01', 90), pt('2026-06-08', 50)]).direction).toBe('WORSENING');
    expect(portfolioTrend([pt('2026-06-01', 80), pt('2026-06-08', 82)]).direction).toBe('STABLE');
    expect(portfolioTrend([]).direction).toBe('STABLE');
  });

  it('weeklySummary descreve a variação vs semana anterior', () => {
    const pt = (weekStart: string, healthScore: number, profit: string): WeeklyPoint => ({ weekStart, healthScore, state: 'HEALTHY', receivable: '1000.00', overdue: '0.00', expectedProfit: profit, opsActive: 2 });
    const s = weeklySummary([pt('2026-06-01', 70, '300.00'), pt('2026-06-08', 80, '500.00')]);
    expect(s).toContain('Saúde 80/100');
    expect(s).toContain('+10');
  });

  it('portfolioIntelligence compõe tudo', () => {
    const intel = portfolioIntelligence([row({ id: '1', debtorName: 'A', amountDue: '5000.00' })]);
    expect(intel.health.state).toBe('HEALTHY');
    expect(intel.topClient?.name).toBe('A');
    expect(intel.summary).toContain('1 operação ativa');
    expect(Array.isArray(intel.actionItems)).toBe(true);
  });
});

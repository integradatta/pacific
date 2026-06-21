import { describe, it, expect } from 'vitest';
import { monthlyRate, balanceAt, accruedInterest, deriveStatus, daysRemaining, summarize, recoverabilityScore, temperatureScore, operationPreview, riskLevel } from './finance.js';
import type { DebtTerms } from '../types/financial.types.js';

const terms = (over: Partial<DebtTerms> = {}): DebtTerms => ({
  principal: '1000.00', rate: '0.10', ratePeriod: 'MONTHLY',
  startDate: new Date('2026-01-01T00:00:00Z'), dueDate: new Date('2026-03-01T00:00:00Z'), ...over,
});

describe('motor financeiro (Decimal.js)', () => {
  it('taxa 0 ⇒ saldo = principal', () => {
    expect(balanceAt(terms({ rate: '0' }), new Date('2026-06-01T00:00:00Z'))).toBe('1000.00');
  });
  it('juros compostos: 1000 a 10%/mês por 30 dias ⇒ 1100.00', () => {
    expect(balanceAt(terms(), new Date('2026-01-31T00:00:00Z'))).toBe('1100.00');
  });
  it('juros acumulados = saldo - principal', () => {
    expect(accruedInterest(terms(), new Date('2026-01-31T00:00:00Z'))).toBe('100.00');
  });
  it('antes do início ⇒ saldo = principal (sem juros negativos)', () => {
    expect(balanceAt(terms(), new Date('2025-12-01T00:00:00Z'))).toBe('1000.00');
  });
  it('normaliza taxa anual para mensal equivalente', () => {
    expect(monthlyRate('0.12', 'ANNUAL').toNumber()).toBeCloseTo(0.009488792934583, 7);
    expect(monthlyRate('0.03', 'MONTHLY').toNumber()).toBe(0.03);
  });
  it('semáforo por dias restantes', () => {
    const asOf = new Date('2026-02-01T00:00:00Z');
    expect(deriveStatus(daysRemaining(terms({ dueDate: new Date('2026-04-01T00:00:00Z') }), asOf))).toBe('GREEN');   // >30
    expect(deriveStatus(daysRemaining(terms({ dueDate: new Date('2026-02-20T00:00:00Z') }), asOf))).toBe('YELLOW');  // <=30
    expect(deriveStatus(daysRemaining(terms({ dueDate: new Date('2026-02-05T00:00:00Z') }), asOf))).toBe('ORANGE');  // <=7
    expect(deriveStatus(daysRemaining(terms({ dueDate: new Date('2026-01-20T00:00:00Z') }), asOf))).toBe('RED');     // vencido
  });
  it('summarize devolve projeções nos horizontes 0/30/90/180/365', () => {
    const s = summarize(terms(), new Date('2026-01-01T00:00:00Z'));
    expect(s.projections.map((p) => p.horizonDays)).toEqual([0, 30, 90, 180, 365]);
    expect(s.projections[0]!.balance).toBe('1000.00');
    expect(s.projections[1]!.balance).toBe('1100.00');
  });
});

describe('scores (0–100)', () => {
  it('temperatura: vencido ⇒ 100; 45 dias ⇒ 50; 90 dias ⇒ 0', () => {
    const asOf = new Date('2026-01-01T00:00:00Z');
    expect(temperatureScore(terms({ dueDate: new Date('2025-12-01T00:00:00Z') }), asOf)).toBe(100);
    expect(temperatureScore(terms({ dueDate: new Date('2026-02-15T00:00:00Z') }), asOf)).toBe(50);
    expect(temperatureScore(terms({ dueDate: new Date('2026-04-01T00:00:00Z') }), asOf)).toBe(0);
  });
  it('recuperabilidade: saudável (no prazo, sem juros) ⇒ 100', () => {
    expect(recoverabilityScore(terms({ rate: '0', dueDate: new Date('2026-06-01T00:00:00Z') }), new Date('2026-02-01T00:00:00Z'))).toBe(100);
  });
  it('recuperabilidade: 90 dias vencido (sem juros) ⇒ 70', () => {
    expect(recoverabilityScore(terms({ rate: '0', dueDate: new Date('2026-01-01T00:00:00Z') }), new Date('2026-04-01T00:00:00Z'))).toBe(70);
  });
  it('recuperabilidade: carga de juros reduz a pontuação (10% de juros ⇒ -2.5)', () => {
    expect(recoverabilityScore(terms({ rate: '0.10', dueDate: new Date('2026-06-01T00:00:00Z') }), new Date('2026-01-31T00:00:00Z'))).toBe(98);
  });
  it('summarize inclui scores 0–100', () => {
    const s = summarize(terms(), new Date('2026-01-01T00:00:00Z'));
    expect(typeof s.scores.recoverability).toBe('number');
    expect(s.scores.temperature).toBeGreaterThanOrEqual(0);
    expect(s.scores.temperature).toBeLessThanOrEqual(100);
  });
});

describe('operationPreview (cadastro em tempo real)', () => {
  it('1000 a 10%/mês por 30 dias: final 1100, juros 100, rentab. 10%, 30 dias', () => {
    const p = operationPreview(terms({ dueDate: new Date('2026-01-31T00:00:00Z') }), new Date('2026-01-01T00:00:00Z'));
    expect(p.finalValue).toBe('1100.00');
    expect(p.totalInterest).toBe('100.00');
    expect(p.profitabilityPct).toBe(10);
    expect(p.expectedReturn).toBe('1100.00');
    expect(p.daysRemaining).toBe(30);
  });
  it('principal zero ⇒ rentabilidade 0 (sem divisão por zero)', () => {
    const p = operationPreview(terms({ principal: '0', dueDate: new Date('2026-01-31T00:00:00Z') }), new Date('2026-01-01T00:00:00Z'));
    expect(p.profitabilityPct).toBe(0);
    expect(p.totalInterest).toBe('0.00');
  });
});

describe('riskLevel (score de risco)', () => {
  it('≥70 baixo, ≥40 médio, abaixo alto (nas bordas)', () => {
    expect(riskLevel(100)).toBe('LOW');
    expect(riskLevel(70)).toBe('LOW');
    expect(riskLevel(69)).toBe('MEDIUM');
    expect(riskLevel(40)).toBe('MEDIUM');
    expect(riskLevel(39)).toBe('HIGH');
    expect(riskLevel(0)).toBe('HIGH');
  });
});

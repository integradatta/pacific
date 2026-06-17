import { describe, it, expect } from 'vitest';
import { monthlyRate, balanceAt, accruedInterest, deriveStatus, daysRemaining, summarize } from './finance.js';
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

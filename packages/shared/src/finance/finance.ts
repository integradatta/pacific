import { Decimal } from 'decimal.js';
import { daysBetween, daysUntil } from '../utils/date.utils.js';
import type { DebtStatus, DebtTerms, DebtSummary, Projection } from '../types/financial.types.js';

const HORIZONS = [0, 30, 90, 180, 365];

/** Taxa mensal equivalente (Decimal). ANNUAL ⇒ (1+a)^(1/12) - 1. */
export function monthlyRate(rate: string, ratePeriod: 'MONTHLY' | 'ANNUAL'): Decimal {
  const r = new Decimal(rate);
  if (ratePeriod === 'MONTHLY') return r;
  return new Decimal(1).plus(r).pow(new Decimal(1).div(12)).minus(1);
}

/** Saldo com juros compostos: principal * (1+i)^(dias/30). Antes do início ⇒ principal. */
export function balanceAt(terms: DebtTerms, asOf: Date): string {
  const principal = new Decimal(terms.principal);
  const days = daysBetween(terms.startDate, asOf);
  if (days <= 0) return principal.toFixed(2);
  const i = monthlyRate(terms.rate, terms.ratePeriod);
  const factor = new Decimal(1).plus(i).pow(new Decimal(days).div(30));
  return principal.times(factor).toFixed(2);
}

export function accruedInterest(terms: DebtTerms, asOf: Date): string {
  return new Decimal(balanceAt(terms, asOf)).minus(terms.principal).toFixed(2);
}

export function daysRemaining(terms: DebtTerms, asOf: Date): number {
  return daysUntil(terms.dueDate, asOf);
}

export function deriveStatus(days: number): DebtStatus {
  if (days < 0) return 'RED';
  if (days <= 7) return 'ORANGE';
  if (days <= 30) return 'YELLOW';
  return 'GREEN';
}

export function projections(terms: DebtTerms, asOf: Date): Projection[] {
  return HORIZONS.map((h) => {
    const at = new Date(asOf.getTime() + h * 86_400_000);
    return { horizonDays: h, balance: balanceAt(terms, at) };
  });
}

export function summarize(terms: DebtTerms, asOf: Date = new Date()): DebtSummary {
  const days = daysRemaining(terms, asOf);
  return {
    balance: balanceAt(terms, asOf),
    accruedInterest: accruedInterest(terms, asOf),
    daysRemaining: days,
    status: deriveStatus(days),
    projections: projections(terms, asOf),
  };
}

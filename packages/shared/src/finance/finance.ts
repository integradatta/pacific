import { Decimal } from 'decimal.js';
import { daysBetween, daysUntil } from '../utils/date.utils.js';
import type { DebtStatus, DebtTerms, DebtSummary, OperationPreview, Projection, RiskLevel } from '../types/financial.types.js';

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

/**
 * Nível de risco a partir do score de recuperabilidade (0–100), que já pondera
 * atraso e carga de juros. ≥70 baixo, ≥40 médio, abaixo alto.
 */
export function riskLevel(recoverability: number): RiskLevel {
  if (recoverability >= 70) return 'LOW';
  if (recoverability >= 40) return 'MEDIUM';
  return 'HIGH';
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/** Urgência temporal 0–100: vencido ⇒ 100; cresce conforme o vencimento se aproxima (horizonte 90d). */
export function temperatureScore(terms: DebtTerms, asOf: Date): number {
  const days = daysRemaining(terms, asOf);
  return clampPct(Math.round(100 * (1 - days / 90)));
}

/** Potencial de recuperação 0–100: penaliza atraso (até -60 em 180 dias) e carga de juros (até -25). */
export function recoverabilityScore(terms: DebtTerms, asOf: Date): number {
  const days = daysRemaining(terms, asOf);
  const daysOverdue = Math.max(0, -days);
  const overduePenalty = Math.min(60, daysOverdue / 3);
  const principal = new Decimal(terms.principal);
  const interestFraction = principal.isZero()
    ? 0
    : new Decimal(accruedInterest(terms, asOf)).div(principal).toNumber();
  const burdenPenalty = Math.min(25, Math.max(0, interestFraction) * 25);
  return clampPct(Math.round(100 - overduePenalty - burdenPenalty));
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
    scores: {
      recoverability: recoverabilityScore(terms, asOf),
      temperature: temperatureScore(terms, asOf),
    },
    projections: projections(terms, asOf),
  };
}

/**
 * Prévia de uma operação no cadastro — os 5 números mostrados em tempo real:
 * valor final (no vencimento), juros totais, rentabilidade %, retorno esperado e dias restantes.
 */
export function operationPreview(terms: DebtTerms, asOf: Date = new Date()): OperationPreview {
  const finalValue = balanceAt(terms, terms.dueDate);
  const principal = new Decimal(terms.principal);
  const totalInterest = new Decimal(finalValue).minus(principal);
  const profitabilityPct = principal.isZero()
    ? 0
    : Math.round(totalInterest.div(principal).times(100).toNumber() * 100) / 100;
  return {
    finalValue,
    totalInterest: totalInterest.toFixed(2),
    profitabilityPct,
    expectedReturn: finalValue,
    daysRemaining: daysRemaining(terms, asOf),
  };
}

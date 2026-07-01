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

/**
 * Saldo com juros compostos: principal * (1+i)^(meses). Antes do início ⇒ principal.
 * Taxa MENSAL cobra no mínimo 1 mês de juros — pagar em menos de 30 dias não reduz
 * proporcionalmente abaixo de um mês cheio (juros mínimo de um mês). Acima de 30 dias
 * é proporcional/composto normalmente.
 */
export function balanceAt(terms: DebtTerms, asOf: Date): string {
  const principal = new Decimal(terms.principal);
  const days = daysBetween(terms.startDate, asOf);
  if (days <= 0) return principal.toFixed(2);
  const i = monthlyRate(terms.rate, terms.ratePeriod);
  let months = new Decimal(days).div(30);
  if (terms.ratePeriod === 'MONTHLY' && months.lessThan(1)) months = new Decimal(1);
  const factor = new Decimal(1).plus(i).pow(months);
  return principal.times(factor).toFixed(2);
}

export function accruedInterest(terms: DebtTerms, asOf: Date): string {
  return new Decimal(balanceAt(terms, asOf)).minus(terms.principal).toFixed(2);
}

/**
 * Valor devido agora = saldo bruto (principal + juros) menos o que já foi pago, com piso
 * em zero. Quitada (settled) ⇒ 0. Usado no painel e na carteira como "a receber".
 */
export function outstanding(grossBalance: string, paidAmount: string, settled: boolean): string {
  if (settled) return '0.00';
  const due = new Decimal(grossBalance).minus(paidAmount || '0');
  return Decimal.max(0, due).toFixed(2);
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

/**
 * Probabilidade de pagamento 0–100 (IA-2). Parte da recuperabilidade (que pondera atraso e carga
 * de juros) e adiciona o sinal de COMPORTAMENTO: quem já abateu parte da dívida tende mais a pagar
 * (bônus de até +20 proporcional ao quanto já foi pago). Quitada ⇒ 100. Determinístico/explicável.
 */
export function paymentProbability(
  terms: DebtTerms,
  asOf: Date,
  settlement: { paidAmount?: string; settled?: boolean } = {},
): number {
  if (settlement.settled) return 100;
  const base = recoverabilityScore(terms, asOf);
  const gross = new Decimal(balanceAt(terms, asOf));
  const paid = new Decimal(settlement.paidAmount || '0');
  const paidFraction = gross.isZero() ? 0 : Math.max(0, Math.min(1, paid.div(gross).toNumber()));
  const payingBonus = Math.round(paidFraction * 20);
  return clampPct(base + payingBonus);
}

export function projections(terms: DebtTerms, asOf: Date): Projection[] {
  return HORIZONS.map((h) => {
    const at = new Date(asOf.getTime() + h * 86_400_000);
    return { horizonDays: h, balance: balanceAt(terms, at) };
  });
}

export function summarize(
  terms: DebtTerms,
  asOf: Date = new Date(),
  settlement: { paidAmount?: string; settledAt?: Date | null } = {},
): DebtSummary {
  const days = daysRemaining(terms, asOf);
  const balance = balanceAt(terms, asOf);
  const paidAmount = new Decimal(settlement.paidAmount || '0').toFixed(2);
  const settled = settlement.settledAt != null;
  return {
    balance,
    accruedInterest: accruedInterest(terms, asOf),
    paidAmount,
    amountDue: outstanding(balance, paidAmount, settled),
    settled,
    daysRemaining: days,
    status: deriveStatus(days),
    scores: {
      recoverability: recoverabilityScore(terms, asOf),
      temperature: temperatureScore(terms, asOf),
      paymentProbability: paymentProbability(terms, asOf, { paidAmount, settled }),
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

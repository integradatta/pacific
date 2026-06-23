import { Decimal } from 'decimal.js';
import { riskLevel } from '../finance/finance.js';
import type { DebtStatus, PortfolioRow, RiskLevel } from '../types/financial.types.js';

// ── Tipos da camada de inteligência (tudo derivado da carteira; nenhuma infra/envio externo) ──

export type HealthState = 'HEALTHY' | 'ATTENTION' | 'CRITICAL';

export interface HealthFactor {
  label: string;
  penalty: number; // quanto subtraiu da saúde (0–100)
}
export interface PortfolioHealth {
  score: number; // 0–100
  state: HealthState;
  factors: HealthFactor[]; // explicabilidade da saúde
}

export interface ClientAggregate {
  name: string;
  exposure: string; // soma do devido agora (operações em aberto)
  expectedProfit: string; // soma de (valor final − principal) das operações em aberto
  opsCount: number;
  overdueCount: number;
  sharePct: number; // % da exposição total da carteira
  avgRecoverability: number;
  worstRisk: RiskLevel;
}

export interface Concentration {
  top3Pct: number;
  top5Pct: number;
  top10Pct: number;
  topClients: { name: string; sharePct: number }[]; // até 3
}

export type InsightTone = 'info' | 'good' | 'warn' | 'danger';
/** Filtro que a UI aplica ao clicar no insight. `client` abre a lista daquele cliente. */
export type InsightFilter =
  | { kind: 'overdue' }
  | { kind: 'dueSoon'; days: number }
  | { kind: 'highRisk' }
  | { kind: 'all' }
  | { kind: 'client'; name: string };

export interface Insight {
  id: string;
  text: string;
  tone: InsightTone;
  filter: InsightFilter;
}

export type ActionKind = 'overdue' | 'dueSoon' | 'highRisk' | 'highValue' | 'concentration';
export interface ActionItem {
  id: string;
  opId?: string;
  client: string;
  reason: string; // explicabilidade
  kind: ActionKind;
  amountDue: string;
  priority: number; // maior = mais urgente
}

export interface RankedOp {
  id: string;
  client: string;
  amountDue: string;
  expectedProfit: string;
  profitabilityPct: number;
  recoverability: number;
  status: DebtStatus;
}

export interface Rankings {
  mostProfitable: RankedOp[];
  riskiest: RankedOp[];
  clientsByExposure: ClientAggregate[];
  clientsByRisk: ClientAggregate[];
  clientsByProfit: ClientAggregate[];
}

export interface PortfolioIntelligence {
  health: PortfolioHealth;
  summary: string;
  insights: Insight[];
  concentration: Concentration;
  topClient: ClientAggregate | null;
  rankings: Rankings;
  actionItems: ActionItem[];
}

/** Limiares do credor (com defaults sensatos). Mantidos configuráveis sem regra fixa global. */
export interface IntelligenceThresholds {
  highRiskBelow: number; // recoverability abaixo disso conta como alto risco (default 40)
  concentrationLimitPct: number; // top-3 acima disso dispara alerta (default 40)
  dueSoonDays: number; // janela de "vencendo em breve" (default 7)
}
export const DEFAULT_THRESHOLDS: IntelligenceThresholds = {
  highRiskBelow: 40,
  concentrationLimitPct: 40,
  dueSoonDays: 7,
};

// ── Helpers ──

const money = (n: Decimal | string | number): string => new Decimal(n).toFixed(2);
const open = (rows: PortfolioRow[]): PortfolioRow[] => rows.filter((r) => !r.settled);
const opProfit = (r: PortfolioRow): Decimal => Decimal.max(0, new Decimal(r.expectedReturn).minus(r.principal));
const opProfitabilityPct = (r: PortfolioRow): number => {
  const p = new Decimal(r.principal);
  return p.isZero() ? 0 : Math.round(opProfit(r).div(p).times(100).toNumber() * 100) / 100;
};
const isHighRisk = (r: PortfolioRow, t: IntelligenceThresholds): boolean => r.recoverability < t.highRiskBelow;

function pct(part: Decimal, whole: Decimal): number {
  if (whole.isZero()) return 0;
  return Math.round(part.div(whole).times(100).toNumber());
}

function brl(value: string | Decimal): string {
  return new Decimal(value)
    .toNumber()
    .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ── Agregação por cliente ──

export function clientAggregates(rows: PortfolioRow[]): ClientAggregate[] {
  const openRows = open(rows);
  const totalExposure = openRows.reduce((s, r) => s.plus(r.amountDue), new Decimal(0));
  const byName = new Map<string, PortfolioRow[]>();
  for (const r of openRows) {
    const list = byName.get(r.debtorName) ?? [];
    list.push(r);
    byName.set(r.debtorName, list);
  }
  const aggs: ClientAggregate[] = [];
  for (const [name, list] of byName) {
    const exposure = list.reduce((s, r) => s.plus(r.amountDue), new Decimal(0));
    const profit = list.reduce((s, r) => s.plus(opProfit(r)), new Decimal(0));
    const recovSum = list.reduce((s, r) => s + r.recoverability, 0);
    const worst = Math.min(...list.map((r) => r.recoverability));
    aggs.push({
      name,
      exposure: money(exposure),
      expectedProfit: money(profit),
      opsCount: list.length,
      overdueCount: list.filter((r) => r.status === 'RED').length,
      sharePct: pct(exposure, totalExposure),
      avgRecoverability: Math.round(recovSum / list.length),
      worstRisk: riskLevel(worst),
    });
  }
  return aggs.sort((a, b) => new Decimal(b.exposure).minus(a.exposure).toNumber());
}

// ── Concentração ──

export function concentration(rows: PortfolioRow[], aggs = clientAggregates(rows)): Concentration {
  const total = aggs.reduce((s, a) => s.plus(a.exposure), new Decimal(0));
  const sumTop = (n: number) =>
    pct(aggs.slice(0, n).reduce((s, a) => s.plus(a.exposure), new Decimal(0)), total);
  return {
    top3Pct: sumTop(3),
    top5Pct: sumTop(5),
    top10Pct: sumTop(10),
    topClients: aggs.slice(0, 3).map((a) => ({ name: a.name, sharePct: a.sharePct })),
  };
}

// ── Saúde da carteira ──

export function portfolioHealth(
  rows: PortfolioRow[],
  t: IntelligenceThresholds = DEFAULT_THRESHOLDS,
  conc = concentration(rows),
): PortfolioHealth {
  const openRows = open(rows);
  const n = openRows.length;
  if (n === 0) return { score: 100, state: 'HEALTHY', factors: [] };

  const overdue = openRows.filter((r) => r.status === 'RED').length / n;
  const highRisk = openRows.filter((r) => isHighRisk(r, t)).length / n;
  const dueSoon = openRows.filter((r) => r.daysRemaining >= 0 && r.daysRemaining <= t.dueSoonDays).length / n;
  // Concentração só é "excessiva" quando há diversificação possível (>3 clientes); com ≤3 o
  // top-3 é ~100% por estrutura, não por risco — não penaliza.
  const clientCount = new Set(openRows.map((r) => r.debtorName)).size;
  const overConc = clientCount > 3 ? Math.max(0, conc.top3Pct - t.concentrationLimitPct) / 100 : 0;

  const factors: HealthFactor[] = [
    { label: 'Operações vencidas', penalty: Math.round(overdue * 40) },
    { label: 'Operações de alto risco', penalty: Math.round(highRisk * 30) },
    { label: 'Concentração excessiva', penalty: Math.round(overConc * 50) },
    { label: 'Vencimentos próximos', penalty: Math.round(dueSoon * 15) },
  ].filter((f) => f.penalty > 0);

  const score = Math.max(0, Math.min(100, 100 - factors.reduce((s, f) => s + f.penalty, 0)));
  const state: HealthState = score >= 70 ? 'HEALTHY' : score >= 40 ? 'ATTENTION' : 'CRITICAL';
  return { score, state, factors };
}

// ── Resumo executivo ──

export function executiveSummary(rows: PortfolioRow[], t: IntelligenceThresholds = DEFAULT_THRESHOLDS): string {
  const openRows = open(rows);
  if (openRows.length === 0) return 'Sua carteira não possui operações ativas no momento.';
  const profit = openRows.reduce((s, r) => s.plus(opProfit(r)), new Decimal(0));
  const attention = openRows.filter((r) => r.status === 'RED' || r.status === 'ORANGE').length;
  const highRisk = openRows.filter((r) => isHighRisk(r, t)).length;
  const sentences: string[] = [
    `Sua carteira possui ${openRows.length} ${openRows.length === 1 ? 'operação ativa' : 'operações ativas'}.`,
    `O lucro projetado é de ${brl(profit)}.`,
  ];
  if (attention > 0 && highRisk > 0)
    sentences.push(`Existem ${attention} ${attention === 1 ? 'operação que exige' : 'operações que exigem'} atenção imediata e ${highRisk} ${highRisk === 1 ? 'classificada' : 'classificadas'} como alto risco.`);
  else if (attention > 0)
    sentences.push(`Existem ${attention} ${attention === 1 ? 'operação que exige' : 'operações que exigem'} atenção imediata.`);
  else if (highRisk > 0)
    sentences.push(`Existem ${highRisk} ${highRisk === 1 ? 'operação classificada' : 'operações classificadas'} como alto risco.`);
  return sentences.join(' ');
}

// ── Explicabilidade do score (motivo) ──

export function riskReason(r: PortfolioRow, t: IntelligenceThresholds = DEFAULT_THRESHOLDS): string {
  const level = riskLevel(r.recoverability);
  const reasons: string[] = [];
  if (r.daysRemaining < 0) reasons.push(`atraso de ${Math.abs(r.daysRemaining)} dia(s)`);
  else if (r.daysRemaining <= t.dueSoonDays) reasons.push(`vence em ${r.daysRemaining} dia(s)`);
  const interest = opProfit(r);
  const principal = new Decimal(r.principal);
  if (!principal.isZero() && interest.div(principal).greaterThan(0.3)) reasons.push('carga de juros elevada');
  const label = level === 'HIGH' ? 'Alto risco' : level === 'MEDIUM' ? 'Médio risco' : 'Baixo risco';
  return reasons.length ? `${label}: ${reasons.join(' + ')}.` : `${label}.`;
}

// ── Insights automáticos (clicáveis) ──

export function insights(rows: PortfolioRow[], t: IntelligenceThresholds = DEFAULT_THRESHOLDS): Insight[] {
  const openRows = open(rows);
  const out: Insight[] = [];
  if (openRows.length === 0) return out;

  const dueSoon = openRows.filter((r) => r.daysRemaining >= 0 && r.daysRemaining <= t.dueSoonDays).length;
  if (dueSoon > 0)
    out.push({ id: 'due-soon', tone: 'warn', text: `${dueSoon} ${dueSoon === 1 ? 'operação vence' : 'operações vencem'} nos próximos ${t.dueSoonDays} dias.`, filter: { kind: 'dueSoon', days: t.dueSoonDays } });

  const overdue = openRows.filter((r) => r.status === 'RED').length;
  if (overdue > 0)
    out.push({ id: 'overdue', tone: 'danger', text: `${overdue} ${overdue === 1 ? 'operação vencida' : 'operações vencidas'} aguardando ação.`, filter: { kind: 'overdue' } });

  const highRisk = openRows.filter((r) => isHighRisk(r, t)).length;
  if (highRisk > 0)
    out.push({ id: 'high-risk', tone: 'danger', text: `${pct(new Decimal(highRisk), new Decimal(openRows.length))}% da carteira está classificada como alto risco.`, filter: { kind: 'highRisk' } });

  const top = clientAggregates(openRows)[0];
  if (top && top.sharePct >= 15)
    out.push({ id: 'top-client', tone: 'info', text: `O cliente ${top.name} representa ${top.sharePct}% da sua exposição total.`, filter: { kind: 'client', name: top.name } });

  const profit = openRows.reduce((s, r) => s.plus(opProfit(r)), new Decimal(0));
  if (profit.greaterThan(0))
    out.push({ id: 'profit', tone: 'good', text: `O lucro projetado da carteira é de ${brl(profit)}.`, filter: { kind: 'all' } });

  return out;
}

// ── Centro de ação: "O que preciso resolver hoje?" ──

export function actionItems(rows: PortfolioRow[], t: IntelligenceThresholds = DEFAULT_THRESHOLDS): ActionItem[] {
  const openRows = open(rows);
  const items: ActionItem[] = [];
  for (const r of openRows) {
    if (r.status === 'RED') {
      items.push({ id: `ov-${r.id}`, opId: r.id, client: r.debtorName, kind: 'overdue', amountDue: r.amountDue, reason: riskReason(r, t), priority: 1000 + Math.abs(r.daysRemaining) });
    } else if (r.daysRemaining <= t.dueSoonDays) {
      items.push({ id: `ds-${r.id}`, opId: r.id, client: r.debtorName, kind: 'dueSoon', amountDue: r.amountDue, reason: `Vence em ${r.daysRemaining} dia(s).`, priority: 700 - r.daysRemaining });
    } else if (isHighRisk(r, t)) {
      items.push({ id: `hr-${r.id}`, opId: r.id, client: r.debtorName, kind: 'highRisk', amountDue: r.amountDue, reason: riskReason(r, t), priority: 500 + (t.highRiskBelow - r.recoverability) });
    }
  }
  // Operações de maior valor que ainda não entraram por outro motivo.
  const flagged = new Set(items.map((i) => i.opId));
  const byValue = [...openRows].filter((r) => !flagged.has(r.id)).sort((a, b) => new Decimal(b.amountDue).minus(a.amountDue).toNumber());
  for (const r of byValue.slice(0, 3)) {
    items.push({ id: `hv-${r.id}`, opId: r.id, client: r.debtorName, kind: 'highValue', amountDue: r.amountDue, reason: `Maior exposição: ${brl(r.amountDue)}.`, priority: 200 + new Decimal(r.amountDue).div(1000).toNumber() });
  }
  // Alerta de concentração (item único de carteira).
  const conc = concentration(openRows);
  if (conc.top3Pct >= t.concentrationLimitPct) {
    items.push({ id: 'conc', client: conc.topClients.map((c) => c.name).join(', '), kind: 'concentration', amountDue: '0.00', reason: `${conc.top3Pct}% da carteira está concentrada em 3 clientes.`, priority: 900 });
  }
  return items.sort((a, b) => b.priority - a.priority);
}

// ── Rankings ──

function toRanked(r: PortfolioRow): RankedOp {
  return { id: r.id, client: r.debtorName, amountDue: r.amountDue, expectedProfit: money(opProfit(r)), profitabilityPct: opProfitabilityPct(r), recoverability: r.recoverability, status: r.status };
}

export function rankings(rows: PortfolioRow[], aggs = clientAggregates(rows)): Rankings {
  const openRows = open(rows);
  const mostProfitable = [...openRows].sort((a, b) => opProfit(b).minus(opProfit(a)).toNumber()).slice(0, 5).map(toRanked);
  const riskiest = [...openRows].sort((a, b) => a.recoverability - b.recoverability).slice(0, 5).map(toRanked);
  return {
    mostProfitable,
    riskiest,
    clientsByExposure: aggs.slice(0, 5),
    clientsByRisk: [...aggs].sort((a, b) => a.avgRecoverability - b.avgRecoverability).slice(0, 5),
    clientsByProfit: [...aggs].sort((a, b) => new Decimal(b.expectedProfit).minus(a.expectedProfit).toNumber()).slice(0, 5),
  };
}

// ── Composição ──

export function portfolioIntelligence(rows: PortfolioRow[], t: IntelligenceThresholds = DEFAULT_THRESHOLDS): PortfolioIntelligence {
  const aggs = clientAggregates(rows);
  const conc = concentration(rows, aggs);
  return {
    health: portfolioHealth(rows, t, conc),
    summary: executiveSummary(rows, t),
    insights: insights(rows, t),
    concentration: conc,
    topClient: aggs[0] ?? null,
    rankings: rankings(rows, aggs),
    actionItems: actionItems(rows, t),
  };
}

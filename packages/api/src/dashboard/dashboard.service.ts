import { Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { balanceAt, deriveStatus, daysRemaining, outstanding, recoverabilityScore, temperatureScore, paymentProbability, riskLevel, riskReason, portfolioIntelligence, currentWeeklyPoint, portfolioTrend, weeklySummary, DEFAULT_THRESHOLDS, type DashboardKpis, type DebtStatus, type RiskLevel, type PortfolioRow, type PortfolioIntelligence, type HealthState, type WeeklyPoint, type IntelligenceThresholds } from '@pacific/shared';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';

@Injectable()
export class DashboardService {
  constructor(private readonly scoped: TenantScopedService) {}

  // Agregação de carteira (escala pequena, ~100 dívidas/tenant). Saldo/status calculados
  // pelo motor financeiro; somatórios em Decimal.js. Operações quitadas saem de "a receber"
  // e das contagens em aberto; o "a receber"/"vencido" usam o DEVIDO (bruto − pago).
  async kpis(tenantId: string, asOf: Date = new Date()): Promise<DashboardKpis> {
    const debts = await this.scoped.withTenant(tenantId, (tx) => tx.debt.findMany({ where: { tenantId, deletedAt: null } }));
    let totalLent = new Decimal(0);
    let totalReceivable = new Decimal(0);
    let totalOverdue = new Decimal(0);
    let totalExpectedReturn = new Decimal(0);
    let totalReceived = new Decimal(0);
    let countActive = 0;
    let countSettled = 0;
    const countByStatus: Record<DebtStatus, number> = { GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 };
    const riskDistribution: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 0, HIGH: 0 };
    for (const d of debts) {
      const terms = {
        principal: d.principal.toString(),
        rate: d.rate.toString(),
        ratePeriod: d.ratePeriod,
        startDate: d.startDate,
        dueDate: d.dueDate,
      };
      totalLent = totalLent.plus(d.principal.toString());
      totalReceived = totalReceived.plus(d.paidAmount.toString());

      const settled = d.settledAt != null;
      if (settled) {
        countSettled += 1;
        continue; // quitada: não entra em a receber/vencido/contagens em aberto
      }

      const balance = balanceAt(terms, asOf);
      const due = new Decimal(outstanding(balance, d.paidAmount.toString(), false));
      const status = deriveStatus(daysRemaining(terms, asOf));
      totalReceivable = totalReceivable.plus(due);
      totalExpectedReturn = totalExpectedReturn.plus(balanceAt(terms, terms.dueDate)); // valor final no vencimento
      if (status === 'RED') totalOverdue = totalOverdue.plus(due);
      else countActive += 1;
      countByStatus[status] += 1;
      riskDistribution[riskLevel(recoverabilityScore(terms, asOf))] += 1;
    }
    return {
      totalLent: totalLent.toFixed(2),
      totalReceivable: totalReceivable.toFixed(2),
      totalOverdue: totalOverdue.toFixed(2),
      totalExpectedReturn: totalExpectedReturn.toFixed(2),
      totalReceived: totalReceived.toFixed(2),
      countActive,
      countSettled,
      countByStatus,
      riskDistribution,
    };
  }

  async portfolio(tenantId: string, asOf: Date = new Date()): Promise<PortfolioRow[]> {
    const debts = await this.scoped.withTenant(tenantId, (tx) =>
      tx.debt.findMany({
        where: { tenantId, deletedAt: null },
        include: { debtor: { select: { name: true } } },
        orderBy: { dueDate: 'asc' },
      }),
    );
    return debts.map((d) => {
      const terms = {
        principal: d.principal.toString(),
        rate: d.rate.toString(),
        ratePeriod: d.ratePeriod,
        startDate: d.startDate,
        dueDate: d.dueDate,
      };
      const days = daysRemaining(terms, asOf);
      const balance = balanceAt(terms, asOf);
      const settled = d.settledAt != null;
      const base: PortfolioRow = {
        id: d.id,
        debtorName: d.debtor.name,
        principal: d.principal.toFixed(2),
        balance,
        amountDue: outstanding(balance, d.paidAmount.toString(), settled),
        paidAmount: d.paidAmount.toFixed(2),
        expectedReturn: balanceAt(terms, terms.dueDate), // valor final no vencimento (p/ lucro projetado)
        settled,
        daysRemaining: days,
        status: deriveStatus(days),
        recoverability: recoverabilityScore(terms, asOf),
        temperature: temperatureScore(terms, asOf),
        paymentProbability: paymentProbability(terms, asOf, { paidAmount: d.paidAmount.toString(), settled }),
        riskReason: '',
        dueDate: d.dueDate.toISOString(),
        tags: d.tags,
      };
      // Explicabilidade do risco computada no servidor (não embarca o motor no client).
      return { ...base, riskReason: riskReason(base) };
    });
  }

  /**
   * Camada de inteligência da carteira (saúde, resumo, insights, concentração, rankings, ações).
   * Tudo DERIVADO da carteira (reusa `portfolio`); nenhuma infra/envio externo. In-app/assistivo.
   */
  async intelligence(tenantId: string, asOf: Date = new Date(), thresholds: IntelligenceThresholds = DEFAULT_THRESHOLDS): Promise<PortfolioIntelligence> {
    const rows = await this.portfolio(tenantId, asOf);
    const intel = portfolioIntelligence(rows, thresholds);
    const points = await this.weeklyHistory(tenantId, currentWeeklyPoint(rows, asOf, thresholds));
    return { ...intel, trend: portfolioTrend(points), weeklySummary: weeklySummary(points), patterns: this.detectPatterns(rows, intel, points) };
  }

  /**
   * IA-3 — Padrões detectados automaticamente (frases prontas): concentração no maior cliente,
   * variação do valor vencido em ~30 dias (do histórico semanal) e fatia em alto risco. Sem LLM.
   */
  private detectPatterns(rows: PortfolioRow[], intel: PortfolioIntelligence, points: WeeklyPoint[]): string[] {
    const out: string[] = [];
    const open = rows.filter((r) => !r.settled);

    // Concentração no maior cliente (≥ 40% da carteira).
    const top = intel.concentration.topClients[0];
    if (top && top.sharePct >= 40) {
      out.push(`Você concentrou ${top.sharePct}% da carteira em ${top.name} — atenção ao risco de concentração.`);
    }

    // Variação do valor vencido nos últimos ~30 dias (pontos semanais; o mais recente vs ~4 semanas atrás).
    if (points.length >= 2) {
      const recent = Number(points[0]!.overdue);
      const past = Number(points[Math.min(points.length - 1, 4)]!.overdue);
      if (past > 0) {
        const deltaPct = Math.round(((recent - past) / past) * 100);
        if (Math.abs(deltaPct) >= 10) {
          out.push(`Nos últimos ~30 dias, o valor vencido ${deltaPct > 0 ? 'aumentou' : 'diminuiu'} ${Math.abs(deltaPct)}%.`);
        }
      }
    }

    // Fatia em alto risco de não pagamento (probabilidade < 50%).
    const highRisk = open.filter((r) => r.paymentProbability < 50).length;
    if (open.length > 0 && highRisk / open.length >= 0.25) {
      out.push(`${highRisk} de ${open.length} operações em aberto estão em alto risco de não pagamento.`);
    }

    return out;
  }

  /**
   * Persiste o snapshot da semana atual (idempotente por tenant+semana; best-effort, nunca quebra
   * o dashboard) e devolve as últimas ~6 semanas. In-app — nenhum envio externo.
   */
  private async weeklyHistory(tenantId: string, point: WeeklyPoint): Promise<WeeklyPoint[]> {
    const db = this.scoped.raw();
    const weekStart = new Date(point.weekStart);
    const data = { healthScore: point.healthScore, state: point.state, receivable: point.receivable, overdue: point.overdue, expectedProfit: point.expectedProfit, opsActive: point.opsActive };
    try {
      await db.portfolioSnapshot.upsert({
        where: { tenantId_weekStart: { tenantId, weekStart } },
        create: { tenantId, weekStart, ...data },
        update: { ...data, capturedAt: new Date() },
      });
    } catch {
      /* best-effort */
    }
    const rows = await db.portfolioSnapshot
      .findMany({ where: { tenantId }, orderBy: { weekStart: 'desc' }, take: 6 })
      .catch(() => [] as Awaited<ReturnType<typeof db.portfolioSnapshot.findMany>>);
    return rows.map((s) => ({
      weekStart: s.weekStart.toISOString(),
      healthScore: s.healthScore,
      state: s.state as HealthState,
      receivable: s.receivable.toString(),
      overdue: s.overdue.toString(),
      expectedProfit: s.expectedProfit.toString(),
      opsActive: s.opsActive,
    }));
  }

  /**
   * IA-1 — Copiloto determinístico: respostas prontas para perguntas-chave, DERIVADAS da carteira
   * (reusa `portfolio`/probabilidade). Sem LLM externo: custo zero, sem envio de dados, testável.
   */
  async copilot(tenantId: string, asOf: Date = new Date()): Promise<CopilotResponse> {
    const rows = await this.portfolio(tenantId, asOf);
    const open = rows.filter((r) => !r.settled);
    const brl = (v: Decimal | string) => `R$ ${new Decimal(v).toFixed(2)}`;
    const toRow = (r: PortfolioRow): CopilotRow => ({ id: r.id, debtorName: r.debtorName, amountDue: r.amountDue, daysRemaining: r.daysRemaining, paymentProbability: r.paymentProbability });

    // Quem cobrar hoje: vencidas ou vencendo em ≤3 dias; vencidas primeiro, depois maior valor.
    const toCollect = open
      .filter((r) => r.daysRemaining <= 3)
      .sort((a, b) => a.daysRemaining - b.daysRemaining || Number(b.amountDue) - Number(a.amountDue));
    const collectSum = toCollect.reduce((s, r) => s.plus(r.amountDue), new Decimal(0));
    const collectToday: CopilotAnswer = {
      text:
        toCollect.length === 0
          ? 'Nada para cobrar hoje — nenhuma operação vencida ou vencendo nos próximos 3 dias. 👌'
          : `${toCollect.length} ${toCollect.length === 1 ? 'operação pede' : 'operações pedem'} atenção hoje (vencidas ou vencendo em até 3 dias), somando ${brl(collectSum)}. Comece pelas vencidas e de maior valor.`,
      rows: toCollect.slice(0, 8).map(toRow),
    };

    // Maiores riscos: menor probabilidade de pagamento primeiro.
    const byRisk = [...open].sort((a, b) => a.paymentProbability - b.paymentProbability);
    const highRisk = byRisk.filter((r) => r.paymentProbability < 50);
    const topRisks: CopilotAnswer = {
      text:
        highRisk.length === 0
          ? 'Sua carteira está saudável — nenhuma operação com probabilidade de pagamento abaixo de 50%.'
          : `${highRisk.length} ${highRisk.length === 1 ? 'operação está' : 'operações estão'} em maior risco (menor probabilidade de pagamento). Comece o contato por ${byRisk[0]!.debtorName}.`,
      rows: byRisk.slice(0, 8).map(toRow),
    };

    // Resumo da carteira.
    const receivable = open.reduce((s, r) => s.plus(r.amountDue), new Decimal(0));
    const overdue = open.filter((r) => r.status === 'RED').reduce((s, r) => s.plus(r.amountDue), new Decimal(0));
    const avgProb = open.length === 0 ? 0 : Math.round(open.reduce((s, r) => s + r.paymentProbability, 0) / open.length);
    const summary: CopilotAnswer = {
      text:
        open.length === 0
          ? 'Você não tem operações em aberto no momento.'
          : `Você tem ${open.length} ${open.length === 1 ? 'operação ativa' : 'operações ativas'}, ${brl(receivable)} a receber${overdue.gt(0) ? `, sendo ${brl(overdue)} vencido` : ''}. Probabilidade média de pagamento: ${avgProb}%.`,
      rows: [],
    };

    return { collectToday, topRisks, summary };
  }
}

/** IA-1 — Copiloto: tipos de resposta (derivados da carteira). */
export interface CopilotRow { id: string; debtorName: string; amountDue: string; daysRemaining: number; paymentProbability: number }
export interface CopilotAnswer { text: string; rows: CopilotRow[] }
export interface CopilotResponse { collectToday: CopilotAnswer; topRisks: CopilotAnswer; summary: CopilotAnswer }

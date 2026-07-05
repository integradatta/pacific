import { Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { balanceAt, deriveStatus, daysRemaining, outstanding, recoverabilityScore, temperatureScore, paymentProbability, riskReason, portfolioKpis, portfolioIntelligence, currentWeeklyPoint, portfolioTrend, weeklySummary, DEFAULT_THRESHOLDS, type DashboardKpis, type PortfolioRow, type PortfolioIntelligence, type HealthState, type WeeklyPoint, type IntelligenceThresholds } from '@pacific/shared';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';
import { DebtsService, type PaymentClaimRow } from '../debts/debts.service.js';

/** Payload agregado do dashboard: computa o portfolio UMA vez e deriva tudo dele (menos round-trips). */
export interface DashboardHome {
  kpis: DashboardKpis;
  portfolio: PortfolioRow[];
  intelligence: PortfolioIntelligence;
  pendingClaims: PaymentClaimRow[];
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly scoped: TenantScopedService,
    private readonly debts: DebtsService,
  ) {}

  /**
   * #Leveza — uma chamada por tela. Computa o portfolio UMA vez e deriva KPIs + inteligência dele;
   * busca os pagamentos avisados em paralelo. Antes o cliente pedia kpis/portfolio/intelligence/claims
   * separados e o servidor recomputava o portfolio 2x. "Tela que abre pronta."
   */
  async home(tenantId: string, asOf: Date = new Date(), thresholds: IntelligenceThresholds = DEFAULT_THRESHOLDS): Promise<DashboardHome> {
    const rows = await this.portfolio(tenantId, asOf);
    const [intelligence, pendingClaims] = await Promise.all([
      this.intelligenceFromRows(tenantId, rows, asOf, thresholds),
      this.debts.pendingClaims(tenantId),
    ]);
    return { kpis: portfolioKpis(rows), portfolio: rows, intelligence, pendingClaims };
  }

  // Agregação de carteira (escala pequena, ~100 dívidas/tenant). Saldo/status calculados
  // pelo motor financeiro; somatórios em Decimal.js. Operações quitadas saem de "a receber"
  // e das contagens em aberto; o "a receber"/"vencido" usam o DEVIDO (bruto − pago).
  async kpis(tenantId: string, asOf: Date = new Date()): Promise<DashboardKpis> {
    // Deriva do portfolio (fonte única): mesma verdade do resto da tela, sem lógica de somatório duplicada.
    return portfolioKpis(await this.portfolio(tenantId, asOf));
  }

  async portfolio(tenantId: string, asOf: Date = new Date()): Promise<PortfolioRow[]> {
    // #Escalabilidade — transação CURTA: busca as linhas dentro do withTenant e fecha; o cálculo de
    // juros (Decimal, pesado) roda FORA da transação, para não monopolizar conexão do pool sob pgbouncer.
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
    return this.intelligenceFromRows(tenantId, await this.portfolio(tenantId, asOf), asOf, thresholds);
  }

  /** Inteligência a partir de linhas já computadas (evita reconsultar o portfolio). */
  private async intelligenceFromRows(tenantId: string, rows: PortfolioRow[], asOf: Date, thresholds: IntelligenceThresholds): Promise<PortfolioIntelligence> {
    const intel = portfolioIntelligence(rows, thresholds);
    // Histórico é SÓ leitura no caminho do dashboard; o ponto da semana atual entra em memória
    // (a persistência ficou no cron diário — nada de escrita em hot path de leitura).
    const history = await this.readWeeklyHistory(tenantId);
    const points = this.mergeCurrentWeek(history, currentWeeklyPoint(rows, asOf, thresholds));
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

  /** Últimas ~6 semanas persistidas (SÓ leitura). Best-effort: falha vira histórico vazio. */
  private async readWeeklyHistory(tenantId: string): Promise<WeeklyPoint[]> {
    return this.weeklySeries(tenantId, 6);
  }

  /** Série semanal persistida (mais recente primeiro), para a curva de Evolução. Best-effort. */
  async weeklySeries(tenantId: string, take = 26): Promise<WeeklyPoint[]> {
    const db = this.scoped.raw();
    const rows = await db.portfolioSnapshot
      .findMany({ where: { tenantId }, orderBy: { weekStart: 'desc' }, take })
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

  /** Insere/substitui o ponto da semana ATUAL em memória (sem escrever) para exibir a tendência viva. */
  private mergeCurrentWeek(points: WeeklyPoint[], current: WeeklyPoint): WeeklyPoint[] {
    return [current, ...points.filter((p) => p.weekStart !== current.weekStart)].slice(0, 6);
  }

  /**
   * Persiste o snapshot da semana atual (idempotente por tenant+semana). Chamado pelo CRON diário —
   * NUNCA no caminho de leitura do dashboard. Erros SOBEM para o scheduler (que loga por tenant);
   * um catch interno aqui anularia essa observabilidade.
   */
  async captureWeeklySnapshot(tenantId: string, asOf: Date = new Date(), thresholds: IntelligenceThresholds = DEFAULT_THRESHOLDS): Promise<void> {
    const rows = await this.portfolio(tenantId, asOf);
    const point = currentWeeklyPoint(rows, asOf, thresholds);
    const weekStart = new Date(point.weekStart);
    const data = { healthScore: point.healthScore, state: point.state, receivable: point.receivable, overdue: point.overdue, expectedProfit: point.expectedProfit, opsActive: point.opsActive };
    await this.scoped.raw().portfolioSnapshot.upsert({
      where: { tenantId_weekStart: { tenantId, weekStart } },
      create: { tenantId, weekStart, ...data },
      update: { ...data, capturedAt: new Date() },
    });
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

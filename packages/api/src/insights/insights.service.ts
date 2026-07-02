import { Injectable } from '@nestjs/common';
import {
  debtorProfile, cashForecast, coolingScore, balanceAt, outstanding, daysRemaining, paymentProbability,
  type DebtorProfile, type CashForecast, type Trend,
} from '@pacific/shared';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';
import { DashboardService } from '../dashboard/dashboard.service.js';

export interface DebtorSignalRow {
  id: string;
  kind: 'INTENT_TO_PAY' | 'NEED_SUPPORT';
  dueDate: string | null;
  note: string | null;
  createdAt: string;
}

export interface CoolingRow {
  debtId: string;
  debtorId: string;
  debtorName: string;
  amountDue: string;
  daysRemaining: number;
  score: number;
  reasons: string[];
}

export interface SimulationResult {
  portfolioOutstanding: number; // total a receber hoje (aberto)
  newShareOfPortfolio: number; // 0..1 — quanto ESTA ajuda representa do total (após)
  concentrationHigh: boolean; // ESTA ajuda concentra demais a carteira
  debtorExposureBefore: number | null; // exposição atual a este sobrinho (se informado)
  debtorExposureAfter: number | null;
  debtorShareAfter: number | null; // 0..1 — concentração no sobrinho após
  expectedDelayDays: number | null; // atraso provável (do perfil), se houver histórico
  reliability: string | null;
}

export type SuggestionKind = 'support' | 'claim' | 'cooling' | 'overdue' | 'due_soon' | 'intent';
export interface Suggestion {
  id: string;
  kind: SuggestionKind;
  title: string;
  body: string;
  href?: string;
  priority: number;
}

const DAY = 86_400_000;
const CONCENTRATION_LIMIT = 0.3; // 30% da carteira numa única ajuda/sobrinho = alerta

/**
 * Camada de inteligência do padrinho. Deriva insights de dados JÁ coletados (quitações, avisos,
 * logins) — sem coletar nada novo. Tudo tenant-scoped (withTenant/RLS). Começa com o perfil
 * comportamental do sobrinho (#2 + #6); cresce para previsão de caixa, radar e sugestões.
 */
@Injectable()
export class InsightsService {
  constructor(
    private readonly scoped: TenantScopedService,
    private readonly dashboard: DashboardService,
  ) {}

  /** #4 Previsão de caixa ponderada pela probabilidade de pagamento (faixas + por mês). */
  async cashForecast(tenantId: string, now: Date = new Date(), horizonDays = 90): Promise<CashForecast> {
    const rows = await this.dashboard.portfolio(tenantId, now);
    const items = rows
      .filter((r) => !r.settled)
      .map((r) => ({ amountDue: Number(r.amountDue), probability: r.paymentProbability / 100, dueDate: new Date(r.dueDate) }));
    return cashForecast(items, now, horizonDays);
  }

  /** #5 Radar de esfriamento — sobrinhos que dão sinais de risco (desengajamento + vencimento +
   *  baixa probabilidade + silêncio de localização). Ordenado por score; só os "esfriando". */
  async coolingRadar(tenantId: string, now: Date = new Date()): Promise<CoolingRow[]> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const debts = await tx.debt.findMany({ where: { tenantId, deletedAt: null, settledAt: null }, include: { debtor: { select: { id: true, name: true } } } });
      if (debts.length === 0) return [];
      const ids = [...new Set(debts.map((d) => d.debtorId))];
      // Limita a 90 dias: cobre a janela de engajamento (30d + 30d anteriores) e evita scan ilimitado.
      const since = new Date(now.getTime() - 90 * DAY);
      const [logins, consents, positions] = await Promise.all([
        tx.debtorLoginEvent.findMany({ where: { tenantId, debtorId: { in: ids }, success: true, at: { gte: since } }, select: { debtorId: true, at: true } }),
        tx.locationConsent.findMany({ where: { tenantId, debtorId: { in: ids }, state: 'GRANTED' }, select: { debtorId: true } }),
        tx.debtorPosition.findMany({ where: { tenantId, debtorId: { in: ids } }, select: { debtorId: true, recordedAt: true } }),
      ]);
      const loginsBy = new Map<string, number[]>();
      for (const l of logins) { const a = loginsBy.get(l.debtorId) ?? []; a.push(l.at.getTime()); loginsBy.set(l.debtorId, a); }
      const granted = new Set(consents.map((c) => c.debtorId));
      const posBy = new Map(positions.map((p) => [p.debtorId, p.recordedAt.getTime()]));
      const t = now.getTime();

      const out: CoolingRow[] = [];
      for (const d of debts) {
        const terms = { principal: d.principal.toString(), rate: d.rate.toString(), ratePeriod: d.ratePeriod, startDate: d.startDate, dueDate: d.dueDate };
        const days = daysRemaining(terms, now);
        const amountDue = outstanding(balanceAt(terms, now), d.paidAmount.toString(), false);
        const prob = paymentProbability(terms, now, { paidAmount: d.paidAmount.toString(), settled: false });
        const ts = loginsBy.get(d.debtorId) ?? [];
        const lastLoginDaysAgo = ts.length ? Math.floor((t - Math.max(...ts)) / DAY) : null;
        const l30 = ts.filter((x) => t - x <= 30 * DAY).length;
        const lPrev = ts.filter((x) => t - x > 30 * DAY && t - x <= 60 * DAY).length;
        const engagementTrend: Trend = ts.length < 2 ? 'unknown' : l30 > lPrev ? 'up' : l30 < lPrev ? 'down' : 'stable';
        const pos = posBy.get(d.debtorId);
        const locationSilentDays = granted.has(d.debtorId) && pos != null ? Math.floor((t - pos) / DAY) : null;
        const c = coolingScore({ daysToDue: days, lastLoginDaysAgo, engagementTrend, locationGranted: granted.has(d.debtorId), locationSilentDays, paymentProbability: prob });
        if (!c.cooling) continue;
        out.push({ debtId: d.id, debtorId: d.debtorId, debtorName: d.debtor.name, amountDue, daysRemaining: days, score: c.score, reasons: c.reasons });
      }
      return out.sort((a, b) => b.score - a.score);
    });
  }

  /** Perfil comportamental de um sobrinho (como costuma pagar, engajamento, melhor horário). */
  async debtorProfile(tenantId: string, debtorId: string, now: Date = new Date()): Promise<DebtorProfile> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const [settled, claims, logins] = await Promise.all([
        tx.debt.findMany({ where: { tenantId, debtorId, deletedAt: null, settledAt: { not: null } }, select: { dueDate: true, settledAt: true } }),
        tx.paymentClaim.findMany({ where: { tenantId, debtorId }, select: { status: true } }),
        tx.debtorLoginEvent.findMany({ where: { tenantId, debtorId, success: true }, select: { at: true }, orderBy: { at: 'desc' }, take: 300 }),
      ]);
      return debtorProfile({
        settled: settled.filter((s): s is { dueDate: Date; settledAt: Date } => s.settledAt != null).map((s) => ({ dueDate: s.dueDate, settledAt: s.settledAt! })),
        claims: claims.map((c) => ({ status: c.status })),
        logins: logins.map((l) => l.at),
        now,
      });
    });
  }

  /**
   * #9 Simulador de decisão ciente da carteira — o momento "devo emprestar?". Dado um valor (e,
   * opcionalmente, um sobrinho existente), estima o impacto: concentração desta ajuda na carteira,
   * exposição ao sobrinho e atraso provável (do perfil). Só leitura; nada é criado.
   */
  async simulate(tenantId: string, input: { amount: number; debtorId?: string }, now: Date = new Date()): Promise<SimulationResult> {
    const rows = await this.dashboard.portfolio(tenantId, now);
    const open = rows.filter((r) => !r.settled);
    const portfolioOutstanding = open.reduce((s, r) => s + Number(r.amountDue), 0);
    const amount = Math.max(0, input.amount);
    const denom = portfolioOutstanding + amount;
    const newShareOfPortfolio = denom > 0 ? amount / denom : 0;

    let debtorExposureBefore: number | null = null;
    let debtorExposureAfter: number | null = null;
    let debtorShareAfter: number | null = null;
    let expectedDelayDays: number | null = null;
    let reliability: string | null = null;

    if (input.debtorId) {
      const [their, profile] = await Promise.all([
        this.scoped.withTenant(tenantId, (tx) =>
          tx.debt.findMany({ where: { tenantId, debtorId: input.debtorId, deletedAt: null, settledAt: null }, select: { principal: true, rate: true, ratePeriod: true, startDate: true, dueDate: true, paidAmount: true } }),
        ),
        this.debtorProfile(tenantId, input.debtorId, now),
      ]);
      debtorExposureBefore = their.reduce((s, d) => s + Number(outstanding(balanceAt({ principal: d.principal.toString(), rate: d.rate.toString(), ratePeriod: d.ratePeriod, startDate: d.startDate, dueDate: d.dueDate }, now), d.paidAmount.toString(), false)), 0);
      debtorExposureAfter = debtorExposureBefore + amount;
      debtorShareAfter = denom > 0 ? debtorExposureAfter / denom : 0;
      expectedDelayDays = profile.avgDelayDays;
      reliability = profile.reliability;
    }

    const concentrationHigh = Math.max(newShareOfPortfolio, debtorShareAfter ?? 0) >= CONCENTRATION_LIMIT;
    return { portfolioOutstanding, newShareOfPortfolio, concentrationHigh, debtorExposureBefore, debtorExposureAfter, debtorShareAfter, expectedDelayDays, reliability };
  }

  /**
   * #1 "Hoje" — fila de SUGESTÕES (nunca ordens). Compõe os sinais em algo acionável e gentil:
   * pedidos de suporte, pagamentos avisados a confirmar, sobrinhos esfriando, vencidos/a vencer e
   * intenções declaradas. Ordenado por relevância. Copy suave (público de temperamento forte).
   */
  async suggestions(tenantId: string, now: Date = new Date()): Promise<Suggestion[]> {
    const cooling = await this.coolingRadar(tenantId, now);
    const coveredDebtors = new Set(cooling.map((c) => c.debtorId));
    return this.scoped.withTenant(tenantId, async (tx) => {
      const [claims, signals, openDebts, debtors] = await Promise.all([
        tx.paymentClaim.findMany({ where: { tenantId, status: 'PENDING' }, select: { debtId: true, debtorId: true, amount: true } }),
        tx.debtorSignal.findMany({ where: { tenantId, resolvedAt: null }, orderBy: { createdAt: 'desc' } }),
        tx.debt.findMany({ where: { tenantId, deletedAt: null, settledAt: null }, include: { debtor: { select: { id: true, name: true } } } }),
        tx.debtor.findMany({ where: { tenantId }, select: { id: true, name: true } }),
      ]);
      const nameBy = new Map(debtors.map((d) => [d.id, d.name]));
      const firstDebtBy = new Map<string, string>();
      for (const d of openDebts) if (!firstDebtBy.has(d.debtorId)) firstDebtBy.set(d.debtorId, d.id);
      const first = (name: string) => name.split(' ')[0];
      const out: Suggestion[] = [];

      // Sinais do sobrinho (suporte tem prioridade máxima; intenção é informativa).
      for (const s of signals) {
        const nm = first(nameBy.get(s.debtorId) ?? 'seu sobrinho');
        const href = s.debtId ? `/operacoes/${s.debtId}` : firstDebtBy.get(s.debtorId) ? `/operacoes/${firstDebtBy.get(s.debtorId)}` : undefined;
        if (s.kind === 'NEED_SUPPORT') out.push({ id: `sig-${s.id}`, kind: 'support', title: `💬 ${nm} pediu ajuda`, body: `Que tal dar um alô?${s.note ? ` Ele comentou: “${s.note}”.` : ' Às vezes uma conversa já resolve.'}`, href, priority: 100 });
        else out.push({ id: `sig-${s.id}`, kind: 'intent', title: `🤝 ${nm} pretende resolver`, body: s.dueDate ? `Ele avisou que pretende resolver até ${new Date(s.dueDate).toLocaleDateString('pt-BR')}. Nada a fazer agora.` : 'Ele avisou que pretende resolver em breve.', href, priority: 20 });
      }

      // Pagamentos avisados a confirmar.
      for (const c of claims) {
        const nm = first(nameBy.get(c.debtorId) ?? 'seu sobrinho');
        out.push({ id: `claim-${c.debtId}`, kind: 'claim', title: `💸 ${nm} avisou um pagamento`, body: `Quando puder, vale conferir e confirmar (${Number(c.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).`, href: `/operacoes/${c.debtId}`, priority: 90 });
      }

      // Radar de esfriamento.
      for (const r of cooling) {
        out.push({ id: `cool-${r.debtId}`, kind: 'cooling', title: `🌡️ Talvez valha um oi para ${first(r.debtorName)}`, body: `${r.reasons.slice(0, 2).join(' · ')}. Um contato leve costuma ajudar.`, href: `/operacoes/${r.debtId}`, priority: 70 });
      }

      // Vencidos / a vencer (pula quem já está no radar, pra não repetir).
      for (const d of openDebts) {
        if (coveredDebtors.has(d.debtorId)) continue;
        const days = daysRemaining({ principal: d.principal.toString(), rate: d.rate.toString(), ratePeriod: d.ratePeriod, startDate: d.startDate, dueDate: d.dueDate }, now);
        const nm = first(d.debtor.name);
        if (days < 0) out.push({ id: `due-${d.id}`, kind: 'overdue', title: `📌 A ajuda de ${nm} passou da data`, body: 'Sem pressa — um lembrete gentil pode ajudar a resolver.', href: `/operacoes/${d.id}`, priority: 55 });
        else if (days <= 7) out.push({ id: `due-${d.id}`, kind: 'due_soon', title: `📅 ${nm} vence em ${days} dia${days === 1 ? '' : 's'}`, body: 'Talvez valha um lembrete amigável nos próximos dias.', href: `/operacoes/${d.id}`, priority: 40 });
      }

      return out.sort((a, b) => b.priority - a.priority).slice(0, 8);
    });
  }

  /** Sinais em aberto do sobrinho (intenção de pagar / pedido de suporte) — ficam ao lado do nome. */
  async openSignals(tenantId: string, debtorId: string): Promise<DebtorSignalRow[]> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const rows = await tx.debtorSignal.findMany({ where: { tenantId, debtorId, resolvedAt: null }, orderBy: { createdAt: 'desc' } });
      return rows.map((r) => ({ id: r.id, kind: r.kind, dueDate: r.dueDate?.toISOString() ?? null, note: r.note, createdAt: r.createdAt.toISOString() }));
    });
  }

  /** Padrinho marca o sinal como resolvido/ciente (some de "ao lado do nome"). */
  async resolveSignal(tenantId: string, id: string): Promise<void> {
    await this.scoped.withTenant(tenantId, (tx) => tx.debtorSignal.updateMany({ where: { id, tenantId }, data: { resolvedAt: new Date() } }));
  }
}

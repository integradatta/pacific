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

const DAY = 86_400_000;

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
      const [logins, consents, positions] = await Promise.all([
        tx.debtorLoginEvent.findMany({ where: { tenantId, debtorId: { in: ids }, success: true }, select: { debtorId: true, at: true } }),
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

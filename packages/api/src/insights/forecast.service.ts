import { Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { realizedForDebt, type DebtPaymentEvent } from '@pacific/shared';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';
import { DashboardService } from '../dashboard/dashboard.service.js';

/** Um mês do track record de previsão (previsto × realizado). realized null = ainda não reconciliado. */
export interface ForecastPoint { month: string; predicted: string; realized: string | null }

function monthRange(month: string): { start: number; end: number } {
  const [y, m] = month.split('-').map(Number);
  return { start: Date.UTC(y!, m! - 1, 1), end: Date.UTC(y!, m!, 1) };
}

/**
 * P7 — Previsto × realizado (HONESTO, nunca promessa). Captura no início do mês o "provável a
 * receber" (Σ devido×probabilidade das abertas que vencem no mês) e reconcilia depois com o que
 * de fato ENTROU (robusto a renegociação). Alimenta um track record de calibração transparente.
 */
@Injectable()
export class ForecastService {
  constructor(
    private readonly scoped: TenantScopedService,
    private readonly dashboard: DashboardService,
  ) {}

  /** Captura o provável do mês. Não sobrescreve uma captura já feita (vale a do início do mês). */
  async capture(tenantId: string, month: string, now: Date = new Date()): Promise<void> {
    const rows = await this.dashboard.portfolio(tenantId, now);
    const { start, end } = monthRange(month);
    let predicted = new Decimal(0);
    for (const r of rows) {
      if (r.settled) continue;
      const due = new Date(r.dueDate).getTime();
      if (due < start || due >= end) continue;
      predicted = predicted.plus(new Decimal(r.amountDue).times(Math.max(0, Math.min(100, r.paymentProbability)) / 100));
    }
    await this.scoped.withTenant(tenantId, async (tx) => {
      await tx.forecastMonth.upsert({
        where: { tenantId_month: { tenantId, month } },
        create: { tenantId, month, predicted: predicted.toFixed(2) },
        update: {},
      });
    });
  }

  /** Reconcilia um mês: soma o que entrou (incrementos de OPERATION_PAID na janela; reset por reneg). */
  async reconcile(tenantId: string, month: string): Promise<void> {
    const { start, end } = monthRange(month);
    await this.scoped.withTenant(tenantId, async (tx) => {
      const fm = await tx.forecastMonth.findUnique({ where: { tenantId_month: { tenantId, month } }, select: { id: true, reconciledAt: true } });
      if (!fm || fm.reconciledAt) return;
      const events = await tx.platformEvent.findMany({
        where: { tenantId, targetType: 'debt', type: { in: ['OPERATION_PAID', 'OPERATION_UPDATED'] } },
        select: { targetId: true, type: true, at: true, detail: true },
        orderBy: { at: 'asc' },
      });
      const byDebt = new Map<string, DebtPaymentEvent[]>();
      for (const e of events) {
        if (!e.targetId) continue;
        const d = (e.detail ?? {}) as { paidAmount?: string; renegotiated?: boolean };
        let ev: DebtPaymentEvent | null = null;
        if (e.type === 'OPERATION_PAID') ev = { at: e.at.getTime(), kind: 'paid', cumulative: Number(d.paidAmount ?? 0) };
        else if (e.type === 'OPERATION_UPDATED' && d.renegotiated) ev = { at: e.at.getTime(), kind: 'reset' };
        if (!ev) continue;
        const list = byDebt.get(e.targetId) ?? [];
        list.push(ev);
        byDebt.set(e.targetId, list);
      }
      let realized = new Decimal(0);
      for (const evs of byDebt.values()) realized = realized.plus(realizedForDebt(evs, start, end));
      await tx.forecastMonth.update({ where: { id: fm.id }, data: { realized: realized.toFixed(2), reconciledAt: new Date() } });
    });
  }

  /** Meses já reconciliados (previsto × realizado), mais recentes primeiro. */
  async accuracy(tenantId: string): Promise<ForecastPoint[]> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const rows = await tx.forecastMonth.findMany({ where: { tenantId, reconciledAt: { not: null } }, orderBy: { month: 'desc' }, take: 12 });
      return rows.map((r) => ({ month: r.month, predicted: r.predicted.toString(), realized: r.realized ? r.realized.toString() : null }));
    });
  }
}

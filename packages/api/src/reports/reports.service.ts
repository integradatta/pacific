import { Injectable } from '@nestjs/common';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';
import { DashboardService } from '../dashboard/dashboard.service.js';

// REL-1 — Relatório mensal automático (in-app; sem envio externo). Arquiva os números do mês.
export interface MonthlyReportRow {
  month: string; // 'YYYY-MM'
  totalLent: string;
  totalReceivable: string;
  totalReceived: string;
  totalOverdue: string;
  opsActive: number;
  opsSettled: number;
  healthScore: number;
  healthState: string;
  generatedAt: string;
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly scoped: TenantScopedService,
    private readonly dashboard: DashboardService,
  ) {}

  /** Gera/atualiza o relatório de um mês a partir do estado atual da carteira. Idempotente. */
  async generate(tenantId: string, month: string, now: Date = new Date()): Promise<MonthlyReportRow> {
    const [kpis, intel] = await Promise.all([this.dashboard.kpis(tenantId, now), this.dashboard.intelligence(tenantId, now)]);
    const data = {
      totalLent: kpis.totalLent,
      totalReceivable: kpis.totalReceivable,
      totalReceived: kpis.totalReceived,
      totalOverdue: kpis.totalOverdue,
      opsActive: kpis.countActive,
      opsSettled: kpis.countSettled,
      healthScore: intel.health.score,
      healthState: intel.health.state,
    };
    return this.scoped.withTenant(tenantId, async (tx) => {
      const row = await tx.monthlyReport.upsert({
        where: { tenantId_month: { tenantId, month } },
        create: { tenantId, month, ...data },
        update: { ...data, generatedAt: now },
      });
      return this.toRow(row);
    });
  }

  /** Histórico de relatórios mensais (mais recente primeiro). */
  async list(tenantId: string): Promise<MonthlyReportRow[]> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const rows = await tx.monthlyReport.findMany({ where: { tenantId }, orderBy: { month: 'desc' }, take: 36 });
      return rows.map((r) => this.toRow(r));
    });
  }

  private toRow(r: {
    month: string; totalLent: { toString(): string }; totalReceivable: { toString(): string };
    totalReceived: { toString(): string }; totalOverdue: { toString(): string };
    opsActive: number; opsSettled: number; healthScore: number; healthState: string; generatedAt: Date;
  }): MonthlyReportRow {
    return {
      month: r.month,
      totalLent: r.totalLent.toString(),
      totalReceivable: r.totalReceivable.toString(),
      totalReceived: r.totalReceived.toString(),
      totalOverdue: r.totalOverdue.toString(),
      opsActive: r.opsActive,
      opsSettled: r.opsSettled,
      healthScore: r.healthScore,
      healthState: r.healthState,
      generatedAt: r.generatedAt.toISOString(),
    };
  }
}

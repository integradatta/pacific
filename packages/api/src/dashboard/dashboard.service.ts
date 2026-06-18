import { Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { balanceAt, deriveStatus, daysRemaining, recoverabilityScore, temperatureScore, type DashboardKpis, type DebtStatus, type PortfolioRow } from '@pacific/shared';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';

@Injectable()
export class DashboardService {
  constructor(private readonly scoped: TenantScopedService) {}

  // Agregação de carteira (escala pequena, ~100 dívidas/tenant). Saldo/status calculados
  // pelo motor financeiro; somatórios em Decimal.js. A leitura passa por withTenant (RLS).
  async kpis(tenantId: string, asOf: Date = new Date()): Promise<DashboardKpis> {
    const debts = await this.scoped.withTenant(tenantId, (tx) => tx.debt.findMany({ where: { tenantId } }));
    let totalLent = new Decimal(0);
    let totalReceivable = new Decimal(0);
    let totalOverdue = new Decimal(0);
    const countByStatus: Record<DebtStatus, number> = { GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 };
    for (const d of debts) {
      const terms = {
        principal: d.principal.toString(),
        rate: d.rate.toString(),
        ratePeriod: d.ratePeriod,
        startDate: d.startDate,
        dueDate: d.dueDate,
      };
      const balance = new Decimal(balanceAt(terms, asOf));
      const status = deriveStatus(daysRemaining(terms, asOf));
      totalLent = totalLent.plus(d.principal.toString());
      totalReceivable = totalReceivable.plus(balance);
      if (status === 'RED') totalOverdue = totalOverdue.plus(balance);
      countByStatus[status] += 1;
    }
    return {
      totalLent: totalLent.toFixed(2),
      totalReceivable: totalReceivable.toFixed(2),
      totalOverdue: totalOverdue.toFixed(2),
      countByStatus,
    };
  }

  async portfolio(tenantId: string, asOf: Date = new Date()): Promise<PortfolioRow[]> {
    const debts = await this.scoped.withTenant(tenantId, (tx) =>
      tx.debt.findMany({
        where: { tenantId },
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
      return {
        id: d.id,
        debtorName: d.debtor.name,
        balance: balanceAt(terms, asOf),
        daysRemaining: days,
        status: deriveStatus(days),
        recoverability: recoverabilityScore(terms, asOf),
        temperature: temperatureScore(terms, asOf),
        dueDate: d.dueDate.toISOString(),
      };
    });
  }
}

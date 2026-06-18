import { Injectable } from '@nestjs/common';
import { summarize, type DebtSummary } from '@pacific/shared';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';

export interface MyDebt { id: string; dueDate: string; summary: DebtSummary; }

@Injectable()
export class DebtorSelfService {
  constructor(private readonly scoped: TenantScopedService) {}

  async myDebts(tenantId: string, debtorId: string): Promise<MyDebt[]> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const debts = await tx.debt.findMany({ where: { tenantId, debtorId }, orderBy: { dueDate: 'asc' } });
      return debts.map((d) => ({
        id: d.id,
        dueDate: d.dueDate.toISOString(),
        summary: summarize({
          principal: d.principal.toString(),
          rate: d.rate.toString(),
          ratePeriod: d.ratePeriod,
          startDate: d.startDate,
          dueDate: d.dueDate,
        }),
      }));
    });
  }
}

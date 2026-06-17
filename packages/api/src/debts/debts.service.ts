import { Injectable, NotFoundException } from '@nestjs/common';
import type { Debt } from '@pacific/database';
import { summarize, type DebtSummary } from '@pacific/shared';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';
import type { Page } from '../common/pagination.js';
import type { CreateDebtInput } from './dto/create-debt.dto.js';

@Injectable()
export class DebtsService {
  constructor(private readonly scoped: TenantScopedService) {}

  async create(tenantId: string, input: CreateDebtInput): Promise<Debt> {
    const db = this.scoped.db(tenantId);
    const debtor = await db.debtor.findFirst({ where: { id: input.debtorId, tenantId } });
    if (!debtor) throw new NotFoundException('Devedor não encontrado neste tenant');
    return db.debt.create({
      data: {
        tenantId,
        debtorId: input.debtorId,
        description: input.description ?? null,
        principal: input.principal,
        rate: input.rate,
        ratePeriod: input.ratePeriod,
        currency: input.currency ?? 'BRL',
        startDate: new Date(input.startDate),
        dueDate: new Date(input.dueDate),
      },
    });
  }

  async list(tenantId: string, page: { limit: number; offset: number }): Promise<Page<Debt>> {
    const db = this.scoped.db(tenantId);
    const [items, total] = await Promise.all([
      db.debt.findMany({ where: { tenantId }, take: page.limit, skip: page.offset, orderBy: { createdAt: 'desc' } }),
      db.debt.count({ where: { tenantId } }),
    ]);
    return { items, total, limit: page.limit, offset: page.offset };
  }

  async get(tenantId: string, id: string): Promise<Debt> {
    const db = this.scoped.db(tenantId);
    const debt = await db.debt.findFirst({ where: { id, tenantId } });
    if (!debt) throw new NotFoundException('Dívida não encontrada');
    return debt;
  }

  /** Cálculo automático: saldo, juros, dias, status e projeções (tenant-scoped via get). */
  async summary(tenantId: string, id: string): Promise<DebtSummary> {
    const debt = await this.get(tenantId, id);
    return summarize({
      principal: debt.principal.toString(),
      rate: debt.rate.toString(),
      ratePeriod: debt.ratePeriod,
      startDate: debt.startDate,
      dueDate: debt.dueDate,
    });
  }
}

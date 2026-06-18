import { Injectable, NotFoundException } from '@nestjs/common';
import type { Debt, Prisma } from '@pacific/database';
import { summarize, type DebtSummary } from '@pacific/shared';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';
import type { Page } from '../common/pagination.js';
import type { CreateDebtInput } from './dto/create-debt.dto.js';

@Injectable()
export class DebtsService {
  constructor(private readonly scoped: TenantScopedService) {}

  async create(tenantId: string, input: CreateDebtInput): Promise<Debt> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const debtor = await tx.debtor.findFirst({ where: { id: input.debtorId, tenantId } });
      if (!debtor) throw new NotFoundException('Devedor não encontrado neste tenant');
      return tx.debt.create({
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
    });
  }

  async list(tenantId: string, page: { limit: number; offset: number }): Promise<Page<Debt>> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const [items, total] = await Promise.all([
        tx.debt.findMany({ where: { tenantId }, take: page.limit, skip: page.offset, orderBy: { createdAt: 'desc' } }),
        tx.debt.count({ where: { tenantId } }),
      ]);
      return { items, total, limit: page.limit, offset: page.offset };
    });
  }

  async get(tenantId: string, id: string): Promise<Debt> {
    return this.scoped.withTenant(tenantId, (tx) => this.findOne(tx, tenantId, id));
  }

  /** Cálculo automático: saldo, juros, dias, status e projeções (tenant-scoped). */
  async summary(tenantId: string, id: string): Promise<DebtSummary> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const debt = await this.findOne(tx, tenantId, id);
      return summarize({
        principal: debt.principal.toString(),
        rate: debt.rate.toString(),
        ratePeriod: debt.ratePeriod,
        startDate: debt.startDate,
        dueDate: debt.dueDate,
      });
    });
  }

  private async findOne(tx: Prisma.TransactionClient, tenantId: string, id: string): Promise<Debt> {
    const debt = await tx.debt.findFirst({ where: { id, tenantId } });
    if (!debt) throw new NotFoundException('Dívida não encontrada');
    return debt;
  }
}

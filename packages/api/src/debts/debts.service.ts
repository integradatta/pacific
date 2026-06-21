import { Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import type { Debt, Prisma } from '@pacific/database';
import { summarize, normalizeTags, balanceAt, type DebtSummary, type DebtRecord, type DebtEvent } from '@pacific/shared';
import type { PayDebtInput } from './dto/pay-debt.dto.js';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';
import { generateAccessToken, hashAccessToken } from '../auth/access-token.util.js';
import type { Page } from '../common/pagination.js';
import type { CreateDebtInput } from './dto/create-debt.dto.js';
import type { CreateQuickDebtInput } from './dto/create-quick-debt.dto.js';

type DebtWithDebtor = Debt & { debtor: { name: string } };

@Injectable()
export class DebtsService {
  constructor(private readonly scoped: TenantScopedService) {}

  /**
   * Cadastro simplificado: cria cliente (devedor) + acesso + operação (dívida) atomicamente.
   * Mantém o devedor consistente com /devedores (link gerável depois via rotate-link).
   */
  async createQuick(tenantId: string, input: CreateQuickDebtInput): Promise<{ debtorId: string; debtId: string }> {
    const tokenHash = hashAccessToken(generateAccessToken());
    return this.scoped.withTenant(tenantId, async (tx) => {
      const debtor = await tx.debtor.create({ data: { tenantId, name: input.clientName } });
      await tx.debtorAccess.create({ data: { debtorId: debtor.id, tenantId, tokenHash } });
      const debt = await tx.debt.create({
        data: {
          tenantId,
          debtorId: debtor.id,
          description: input.description ?? null,
          tags: normalizeTags(input.tags ?? []),
          principal: input.principal,
          rate: input.rate,
          ratePeriod: input.ratePeriod,
          currency: 'BRL',
          startDate: new Date(),
          dueDate: new Date(input.dueDate),
        },
      });
      return { debtorId: debtor.id, debtId: debt.id };
    });
  }

  async create(tenantId: string, input: CreateDebtInput): Promise<Debt> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const debtor = await tx.debtor.findFirst({ where: { id: input.debtorId, tenantId } });
      if (!debtor) throw new NotFoundException('Devedor não encontrado neste tenant');
      return tx.debt.create({
        data: {
          tenantId,
          debtorId: input.debtorId,
          description: input.description ?? null,
          tags: normalizeTags(input.tags ?? []),
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

  /** Operação completa para a tela de detalhe (inclui nome do devedor e etiquetas). */
  async get(tenantId: string, id: string): Promise<DebtRecord> {
    return this.scoped.withTenant(tenantId, async (tx) => this.toRecord(await this.findOne(tx, tenantId, id)));
  }

  /** Substitui as etiquetas da operação (normalizadas) e devolve o registro atualizado. */
  async setTags(tenantId: string, id: string, tags: string[]): Promise<DebtRecord> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      await this.findOne(tx, tenantId, id); // garante existência + paridade de tenant
      await tx.debt.update({ where: { id }, data: { tags: normalizeTags(tags) } });
      return this.toRecord(await this.findOne(tx, tenantId, id));
    });
  }

  /** Cálculo automático: saldo, juros, devido (− pago), dias, status e projeções (tenant-scoped). */
  async summary(tenantId: string, id: string): Promise<DebtSummary> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const debt = await this.findOne(tx, tenantId, id);
      return summarize(
        {
          principal: debt.principal.toString(),
          rate: debt.rate.toString(),
          ratePeriod: debt.ratePeriod,
          startDate: debt.startDate,
          dueDate: debt.dueDate,
        },
        new Date(),
        { paidAmount: debt.paidAmount.toString(), settledAt: debt.settledAt },
      );
    });
  }

  /**
   * Registra pagamento: parcial (abate `amount` do devido) ou total (`full` ⇒ quita).
   * Quita automaticamente se o pago alcançar o saldo bruto. Cancela os alertas pendentes
   * (não lidos) da dívida. Idempotente sobre uma dívida já quitada.
   */
  async pay(tenantId: string, id: string, input: PayDebtInput, now: Date = new Date()): Promise<DebtRecord> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const debt = await this.findOne(tx, tenantId, id);
      if (debt.settledAt) return this.toRecord(debt);

      const gross = new Decimal(
        balanceAt(
          {
            principal: debt.principal.toString(),
            rate: debt.rate.toString(),
            ratePeriod: debt.ratePeriod,
            startDate: debt.startDate,
            dueDate: debt.dueDate,
          },
          now,
        ),
      );
      const already = new Decimal(debt.paidAmount.toString());
      const delta = Decimal.max(0, new Decimal(input.amount ?? '0')); // ignora valores negativos
      let paid = input.full ? gross : already.plus(delta);
      if (paid.greaterThan(gross)) paid = gross; // não paga além do devido
      const settledAt = input.full || paid.greaterThanOrEqualTo(gross) ? now : null;

      await tx.debt.update({ where: { id }, data: { paidAmount: paid.toFixed(2), settledAt } });
      // Cancela alertas pendentes (não lidos) desta dívida.
      await tx.notification.deleteMany({ where: { tenantId, debtId: id, readAt: null } });

      return this.toRecord(await this.findOne(tx, tenantId, id));
    });
  }

  /**
   * Histórico da operação — DERIVADO de dados existentes (sem tabela de eventos):
   * criação, link de acesso (gerado/rotacionado), acessos do devedor, alertas emitidos
   * e o vencimento (quando já passou). Ordenado do mais recente para o mais antigo.
   */
  async history(tenantId: string, id: string, now: Date = new Date()): Promise<DebtEvent[]> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const debt = await this.findOne(tx, tenantId, id);
      const [notifications, access, logins] = await Promise.all([
        tx.notification.findMany({ where: { tenantId, debtId: id }, orderBy: { createdAt: 'asc' } }),
        tx.debtorAccess.findFirst({ where: { tenantId, debtorId: debt.debtorId } }),
        tx.debtorLoginEvent.findMany({
          where: { tenantId, debtorId: debt.debtorId, success: true },
          orderBy: { at: 'asc' },
        }),
      ]);

      const events: DebtEvent[] = [
        { at: debt.createdAt.toISOString(), kind: 'created', title: 'Operação criada' },
      ];
      if (access) {
        events.push({ at: access.createdAt.toISOString(), kind: 'link', title: 'Link de acesso gerado' });
        if (access.rotatedAt) {
          events.push({ at: access.rotatedAt.toISOString(), kind: 'link', title: 'Link de acesso rotacionado' });
        }
      }
      for (const l of logins) {
        events.push({ at: l.at.toISOString(), kind: 'login', title: 'Devedor acessou o portal' });
      }
      for (const n of notifications) {
        events.push({ at: n.createdAt.toISOString(), kind: 'notification', title: n.title, detail: n.body });
      }
      if (debt.dueDate.getTime() < now.getTime()) {
        events.push({ at: debt.dueDate.toISOString(), kind: 'due', title: 'Operação venceu' });
      }

      return events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    });
  }

  private toRecord(d: DebtWithDebtor): DebtRecord {
    return {
      id: d.id,
      debtorId: d.debtorId,
      debtorName: d.debtor.name,
      description: d.description,
      principal: d.principal.toString(),
      rate: d.rate.toString(),
      ratePeriod: d.ratePeriod,
      currency: d.currency,
      startDate: d.startDate.toISOString(),
      dueDate: d.dueDate.toISOString(),
      status: d.status,
      tags: d.tags,
      paidAmount: d.paidAmount.toString(),
      settledAt: d.settledAt ? d.settledAt.toISOString() : null,
      createdAt: d.createdAt.toISOString(),
    };
  }

  private async findOne(tx: Prisma.TransactionClient, tenantId: string, id: string): Promise<DebtWithDebtor> {
    const debt = await tx.debt.findFirst({ where: { id, tenantId }, include: { debtor: { select: { name: true } } } });
    if (!debt) throw new NotFoundException('Dívida não encontrada');
    return debt;
  }
}

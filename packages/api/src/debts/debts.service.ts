import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import type { Debt, Prisma } from '@pacific/database';
import { summarize, normalizeTags, balanceAt, operationPreview, recoverabilityScore, type DebtSummary, type DebtRecord, type DebtEvent, type OperationPreview } from '@pacific/shared';
import type { PayDebtInput } from './dto/pay-debt.dto.js';
import type { PreviewDebtDto } from './dto/preview-debt.dto.js';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';
import { TrackingService } from '../tracking/tracking.service.js';
import { notifyCreditor } from '../notifications/notify.js';
import { generateAccessToken, hashAccessToken } from '../auth/access-token.util.js';
import type { Page } from '../common/pagination.js';
import type { CreateDebtInput } from './dto/create-debt.dto.js';
import type { CreateQuickDebtInput } from './dto/create-quick-debt.dto.js';

type DebtWithDebtor = Debt & { debtor: { name: string } };

/** Pagamento informado pelo sobrinho, aguardando o padrinho confirmar (loop de mão dupla). */
export interface PaymentClaimRow {
  id: string;
  debtId: string;
  debtorName: string;
  amount: string;
  note: string | null;
  claimedAt: string;
}

@Injectable()
export class DebtsService {
  constructor(
    private readonly scoped: TenantScopedService,
    private readonly tracking: TrackingService,
  ) {}

  /** Prévia da operação — cálculo proprietário (juros/score) roda AQUI, no servidor (não no client). */
  preview(input: PreviewDebtDto, now: Date = new Date()): OperationPreview & { recoverability: number } {
    const terms = {
      principal: input.principal,
      rate: input.rate,
      ratePeriod: input.ratePeriod,
      startDate: input.startDate ? new Date(input.startDate) : now,
      dueDate: new Date(input.dueDate),
    };
    return { ...operationPreview(terms, now), recoverability: recoverabilityScore(terms, now) };
  }

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
          startDate: input.startDate ? new Date(input.startDate) : new Date(),
          dueDate: new Date(input.dueDate),
        },
      });
      await this.tracking.record(tx, { tenantId, actorType: 'CREDITOR', type: 'CLIENT_CREATED', targetType: 'debtor', targetId: debtor.id, detail: { name: input.clientName } });
      await this.tracking.record(tx, { tenantId, actorType: 'CREDITOR', type: 'OPERATION_CREATED', targetType: 'debt', targetId: debt.id });
      return { debtorId: debtor.id, debtId: debt.id };
    });
  }

  async create(tenantId: string, input: CreateDebtInput): Promise<Debt> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const debtor = await tx.debtor.findFirst({ where: { id: input.debtorId, tenantId } });
      if (!debtor) throw new NotFoundException('Sobrinho não encontrado neste tenant');
      const debt = await tx.debt.create({
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
      await this.tracking.record(tx, { tenantId, actorType: 'CREDITOR', type: 'OPERATION_CREATED', targetType: 'debt', targetId: debt.id });
      return debt;
    });
  }

  async list(tenantId: string, page: { limit: number; offset: number }): Promise<Page<Debt>> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const [items, total] = await Promise.all([
        tx.debt.findMany({ where: { tenantId, deletedAt: null }, take: page.limit, skip: page.offset, orderBy: { createdAt: 'desc' } }),
        tx.debt.count({ where: { tenantId, deletedAt: null } }),
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
      await this.tracking.record(tx, { tenantId, actorType: 'CREDITOR', type: 'OPERATION_UPDATED', targetType: 'debt', targetId: id, detail: { field: 'tags' } });
      return this.toRecord(await this.findOne(tx, tenantId, id));
    });
  }

  /**
   * Ajusta as datas da operação — permite registrar/corrigir dívidas ANTIGAS (data inicial no
   * passado). A "gratidão" acumulada é recalculada a partir da nova data inicial (balanceAt usa
   * startDate). Vencimento não pode ser antes da data inicial.
   */
  async updateDates(tenantId: string, id: string, input: { startDate?: string; dueDate?: string }): Promise<DebtRecord> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const debt = await this.findOne(tx, tenantId, id);
      const newStart = input.startDate ? new Date(input.startDate) : debt.startDate;
      const newDue = input.dueDate ? new Date(input.dueDate) : debt.dueDate;
      if (Number.isNaN(newStart.getTime())) throw new BadRequestException('Data inicial inválida.');
      if (Number.isNaN(newDue.getTime())) throw new BadRequestException('Data de vencimento inválida.');
      if (newDue < newStart) throw new BadRequestException('O vencimento não pode ser antes da data inicial.');
      await tx.debt.update({ where: { id }, data: { startDate: newStart, dueDate: newDue } });
      await this.tracking.record(tx, { tenantId, actorType: 'CREDITOR', type: 'OPERATION_UPDATED', targetType: 'debt', targetId: id, detail: { field: 'dates' } });
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
      await this.applyPayment(tx, tenantId, debt, input, now);
      return this.toRecord(await this.findOne(tx, tenantId, id));
    });
  }

  /**
   * Aplica um pagamento à dívida dentro da transação do caller. Núcleo reutilizado por `pay`
   * (padrinho) e por `confirmClaim` (confirmação de um pagamento informado pelo sobrinho).
   * Idempotente sobre dívida já quitada (não faz nada).
   */
  private async applyPayment(
    tx: Prisma.TransactionClient,
    tenantId: string,
    debt: DebtWithDebtor,
    input: PayDebtInput,
    now: Date,
  ): Promise<void> {
    if (debt.settledAt) return;
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

    await tx.debt.update({ where: { id: debt.id }, data: { paidAmount: paid.toFixed(2), settledAt } });
    // Cancela alertas pendentes (não lidos) desta dívida.
    await tx.notification.deleteMany({ where: { tenantId, debtId: debt.id, readAt: null } });
    await this.tracking.record(tx, { tenantId, actorType: 'CREDITOR', type: 'OPERATION_PAID', targetType: 'debt', targetId: debt.id, detail: { paidAmount: paid.toFixed(2), settled: settledAt != null } });
    // Marco positivo: ajuda quitada.
    if (settledAt) {
      const d = await tx.debtor.findUnique({ where: { id: debt.debtorId }, select: { name: true } });
      await notifyCreditor(tx, { tenantId, debtorId: debt.debtorId, debtId: debt.id, type: 'DEBT_SETTLED', title: 'Ajuda quitada 🎉', body: `${d?.name ?? 'Uma ajuda'} — combinado quitado. Tudo certo!` });
    }
  }

  /** Pagamentos informados pelo sobrinho aguardando confirmação do padrinho (toda a carteira). */
  async pendingClaims(tenantId: string): Promise<PaymentClaimRow[]> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const claims = await tx.paymentClaim.findMany({ where: { tenantId, status: 'PENDING' }, orderBy: { claimedAt: 'desc' } });
      if (claims.length === 0) return [];
      const debts = await tx.debt.findMany({
        where: { tenantId, deletedAt: null, id: { in: claims.map((c) => c.debtId) } },
        include: { debtor: { select: { name: true } } },
      });
      const byId = new Map(debts.map((d) => [d.id, d]));
      return claims.map((c) => ({
        id: c.id,
        debtId: c.debtId,
        debtorName: byId.get(c.debtId)?.debtor.name ?? '—',
        amount: c.amount.toFixed(2),
        note: c.note,
        claimedAt: c.claimedAt.toISOString(),
      }));
    });
  }

  /** Confirma um pagamento informado: vira pagamento de fato (reusa applyPayment) e marca o claim. */
  async confirmClaim(tenantId: string, claimId: string, now: Date = new Date()): Promise<void> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const claim = await tx.paymentClaim.findFirst({ where: { id: claimId, tenantId } });
      if (!claim || claim.status !== 'PENDING') throw new NotFoundException('Pagamento informado não encontrado');
      const debt = await this.findOne(tx, tenantId, claim.debtId);
      await this.applyPayment(tx, tenantId, debt, { amount: claim.amount.toString() }, now);
      await tx.paymentClaim.update({ where: { id: claimId }, data: { status: 'CONFIRMED', resolvedAt: now } });
    });
  }

  /** Recusa um pagamento informado (não bate). Registra no tracking; não altera a dívida. */
  async rejectClaim(tenantId: string, claimId: string, now: Date = new Date()): Promise<void> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const claim = await tx.paymentClaim.findFirst({ where: { id: claimId, tenantId } });
      if (!claim || claim.status !== 'PENDING') throw new NotFoundException('Pagamento informado não encontrado');
      await tx.paymentClaim.update({ where: { id: claimId }, data: { status: 'REJECTED', resolvedAt: now } });
      await this.tracking.record(tx, { tenantId, actorType: 'CREDITOR', type: 'OPERATION_UPDATED', targetType: 'debt', targetId: claim.debtId, detail: { claimRejected: true } });
    });
  }

  /**
   * Renegocia (refaz o acordo) de uma operação em aberto: o valor DEVIDO agora vira o novo
   * principal, o relógio reinicia (startDate = agora, pago = 0) e aplicam-se novo vencimento e,
   * opcionalmente, nova taxa. Os termos antigos ficam registrados no histórico. Quitada → erro.
   */
  async renegotiate(
    tenantId: string,
    id: string,
    input: { dueDate: string; rate?: string; ratePeriod?: 'MONTHLY' | 'ANNUAL' },
    now: Date = new Date(),
  ): Promise<DebtRecord> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const debt = await this.findOne(tx, tenantId, id);
      if (debt.settledAt) throw new BadRequestException('Operação quitada não pode ser renegociada.');

      const newDue = new Date(input.dueDate);
      if (Number.isNaN(newDue.getTime()) || newDue.getTime() <= now.getTime()) {
        throw new BadRequestException('Novo vencimento deve ser uma data futura.');
      }
      const gross = new Decimal(
        balanceAt(
          { principal: debt.principal.toString(), rate: debt.rate.toString(), ratePeriod: debt.ratePeriod, startDate: debt.startDate, dueDate: debt.dueDate },
          now,
        ),
      );
      const amountDue = Decimal.max(0, gross.minus(debt.paidAmount.toString()));
      if (amountDue.lessThanOrEqualTo(0)) throw new BadRequestException('Não há saldo em aberto para renegociar.');

      const newRate = input.rate ?? debt.rate.toString();
      const newRatePeriod = input.ratePeriod ?? debt.ratePeriod;
      await tx.debt.update({
        where: { id },
        data: { principal: amountDue.toFixed(2), paidAmount: '0', settledAt: null, startDate: now, dueDate: newDue, rate: newRate, ratePeriod: newRatePeriod },
      });
      // Alertas antigos ficam obsoletos (vencimento mudou) — limpa os não lidos; regeneram depois.
      await tx.notification.deleteMany({ where: { tenantId, debtId: id, readAt: null } });
      await this.tracking.record(tx, {
        tenantId, actorType: 'CREDITOR', type: 'OPERATION_UPDATED', targetType: 'debt', targetId: id,
        detail: {
          renegotiated: true,
          fromDueDate: debt.dueDate.toISOString(), toDueDate: newDue.toISOString(),
          fromRate: debt.rate.toString(), toRate: newRate, newPrincipal: amountDue.toFixed(2),
        },
      });
      return this.toRecord(await this.findOne(tx, tenantId, id));
    });
  }

  /**
   * Move a operação para a LIXEIRA (soft-delete): marca deletedAt e cancela os alertas dela.
   * Restaurável por 30 dias (depois um job depura). Reversível — não apaga dados ainda.
   */
  async remove(tenantId: string, id: string, now: Date = new Date()): Promise<void> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      await this.findOne(tx, tenantId, id); // 404 se não existir / for de outro tenant / já na lixeira
      await tx.notification.deleteMany({ where: { tenantId, debtId: id } });
      await tx.debt.update({ where: { id }, data: { deletedAt: now } });
      await this.tracking.record(tx, { tenantId, actorType: 'CREDITOR', type: 'OPERATION_UPDATED', targetType: 'debt', targetId: id, detail: { trashed: true } });
    });
  }

  /** Lista a lixeira do tenant: operações excluídas (restauráveis), mais recentes primeiro. */
  async listTrash(tenantId: string): Promise<Array<{ id: string; debtorName: string; principal: string; deletedAt: string }>> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const rows = await tx.debt.findMany({
        where: { tenantId, deletedAt: { not: null } },
        include: { debtor: { select: { name: true } } },
        orderBy: { deletedAt: 'desc' },
      });
      return rows.map((d) => ({ id: d.id, debtorName: d.debtor.name, principal: d.principal.toString(), deletedAt: d.deletedAt!.toISOString() }));
    });
  }

  /** Restaura uma operação da lixeira (deletedAt = null). 404 se não estiver na lixeira. */
  async restore(tenantId: string, id: string): Promise<void> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const trashed = await tx.debt.findFirst({ where: { id, tenantId, deletedAt: { not: null } } });
      if (!trashed) throw new NotFoundException('Operação não está na lixeira');
      await tx.debt.update({ where: { id }, data: { deletedAt: null } });
      await this.tracking.record(tx, { tenantId, actorType: 'CREDITOR', type: 'OPERATION_UPDATED', targetType: 'debt', targetId: id, detail: { restored: true } });
    });
  }

  /**
   * Depuração definitiva (job): apaga de vez as dívidas de UM tenant na lixeira há mais de `days`
   * dias. Roda dentro de withTenant (Debt é RLS-forçado → precisa do contexto do tenant).
   */
  async purgeTrashed(tenantId: string, days = 30, now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - days * 86_400_000);
    return this.scoped.withTenant(tenantId, async (tx) => {
      const res = await tx.debt.deleteMany({ where: { tenantId, deletedAt: { not: null, lt: cutoff } } });
      return res.count;
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
      const [notifications, access, logins, changes] = await Promise.all([
        tx.notification.findMany({ where: { tenantId, debtId: id }, orderBy: { createdAt: 'asc' } }),
        tx.debtorAccess.findFirst({ where: { tenantId, debtorId: debt.debtorId } }),
        tx.debtorLoginEvent.findMany({
          where: { tenantId, debtorId: debt.debtorId, success: true },
          orderBy: { at: 'asc' },
        }),
        // Alterações e pagamentos da operação registrados pela camada de tracking (inclui parciais).
        tx.platformEvent.findMany({
          where: { tenantId, targetType: 'debt', targetId: id, type: { in: ['OPERATION_UPDATED', 'OPERATION_PAID'] } },
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
        events.push({ at: l.at.toISOString(), kind: 'login', title: 'Sobrinho acessou o portal' });
      }
      for (const n of notifications) {
        events.push({ at: n.createdAt.toISOString(), kind: 'notification', title: n.title, detail: n.body });
      }
      // Alterações/pagamentos do tracking (timeline de mudanças, inclui pagamentos parciais).
      let trackedSettlement = false;
      for (const c of changes) {
        const d = (c.detail ?? {}) as { field?: string; paidAmount?: string; settled?: boolean; renegotiated?: boolean; toDueDate?: string };
        if (c.type === 'OPERATION_UPDATED') {
          if (d.renegotiated) {
            events.push({ at: c.at.toISOString(), kind: 'updated', title: 'Operação renegociada', detail: d.toDueDate ? `Novo vencimento em ${new Date(d.toDueDate).toLocaleDateString('pt-BR')}` : undefined });
          } else {
            events.push({ at: c.at.toISOString(), kind: 'updated', title: d.field === 'tags' ? 'Etiquetas atualizadas' : 'Operação alterada' });
          }
        } else {
          if (d.settled) trackedSettlement = true;
          events.push({
            at: c.at.toISOString(),
            kind: 'paid',
            title: d.settled ? 'Operação quitada' : 'Pagamento registrado',
            detail: d.paidAmount ? `Pagamento de R$ ${d.paidAmount}` : undefined,
          });
        }
      }
      if (debt.dueDate.getTime() < now.getTime()) {
        events.push({ at: debt.dueDate.toISOString(), kind: 'due', title: 'Operação venceu' });
      }
      // Quitação derivada só se o tracking ainda não registrou (operações antigas, pré-tracking).
      if (debt.settledAt && !trackedSettlement) {
        events.push({ at: debt.settledAt.toISOString(), kind: 'paid', title: 'Operação quitada' });
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

  // Finder padrão: só dívidas ATIVAS (fora da lixeira). Usado por get/summary/history/pay/renegotiate/remove.
  private async findOne(tx: Prisma.TransactionClient, tenantId: string, id: string): Promise<DebtWithDebtor> {
    const debt = await tx.debt.findFirst({ where: { id, tenantId, deletedAt: null }, include: { debtor: { select: { name: true } } } });
    if (!debt) throw new NotFoundException('Dívida não encontrada');
    return debt;
  }
}

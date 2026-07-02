import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { Prisma } from '@pacific/database';
import { Decimal } from 'decimal.js';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';

const DAY = 86_400_000;
const GRACE_DAYS = 2; // tolerância após a data prometida antes de considerar quebrada

export interface PromiseRow {
  id: string;
  debtId: string;
  amount: string | null;
  promisedAt: string;
  note: string | null;
  status: 'OPEN' | 'KEPT' | 'BROKEN';
  createdAt: string;
  resolvedAt: string | null;
}

/**
 * #4 Promessas rastreadas — o padrinho registra um combinado ("paga R$X até <data>") e o desfecho é
 * resolvido automaticamente: KEPT se houve quitação/aviso confirmado até a data (+ tolerância),
 * BROKEN quando a data passa sem pagamento. O histórico alimenta o DebtorScore. Sem implicação
 * jurídica. Tudo tenant-scoped (RLS).
 */
@Injectable()
export class PromisesService {
  private readonly log = new Logger('PromisesService');

  constructor(private readonly scoped: TenantScopedService) {}

  /** Resolve promessas vencidas de todas as carteiras (fecha BROKEN/KEPT sem depender de visualização). */
  @Cron('0 9 * * *') // 06:00 BRT
  async resolveAllDue(): Promise<void> {
    const tenants = await this.scoped
      .raw()
      .tenant.findMany({ where: { status: 'ACTIVE' }, select: { id: true } })
      .catch(() => [] as { id: string }[]);
    let changed = 0;
    for (const t of tenants) {
      try {
        changed += await this.scoped.withTenant(t.id, (tx) => this.resolveDue(tx, t.id));
      } catch (e) {
        this.log.warn(`Falha ao resolver promessas da carteira ${t.id}: ${String(e)}`);
      }
    }
    if (changed > 0) this.log.log(`Promessas resolvidas: ${changed}.`);
  }

  /** Padrinho registra a promessa sobre uma ajuda aberta. Resolve o sobrinho a partir da dívida. */
  async create(tenantId: string, input: { debtId: string; promisedAt: string; amount?: string; note?: string }): Promise<PromiseRow> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const debt = await tx.debt.findFirst({ where: { id: input.debtId, tenantId, deletedAt: null }, select: { id: true, debtorId: true, settledAt: true } });
      if (!debt) throw new NotFoundException('Ajuda não encontrada');
      if (debt.settledAt) throw new BadRequestException('Esta ajuda já está quitada.');
      const when = new Date(input.promisedAt);
      if (Number.isNaN(when.getTime())) throw new BadRequestException('Data da promessa inválida.');
      const amount = input.amount != null && Number(input.amount) > 0 ? new Decimal(input.amount).toFixed(2) : null;
      const created = await tx.paymentPromise.create({
        data: { tenantId, debtorId: debt.debtorId, debtId: debt.id, promisedAt: when, amount, note: input.note?.trim().slice(0, 280) || null },
      });
      return this.toRow(created);
    });
  }

  /** Promessas de um sobrinho (para o card de perfil). Resolve as vencidas antes de listar. */
  async listForDebtor(tenantId: string, debtorId: string, now: Date = new Date()): Promise<PromiseRow[]> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      await this.resolveDue(tx, tenantId, debtorId, now);
      const rows = await tx.paymentPromise.findMany({ where: { tenantId, debtorId }, orderBy: { createdAt: 'desc' }, take: 20 });
      return rows.map((r) => this.toRow(r));
    });
  }

  /** Padrinho remove/cancela uma promessa ainda aberta (registrada por engano). */
  async remove(tenantId: string, id: string): Promise<void> {
    await this.scoped.withTenant(tenantId, async (tx) => {
      const p = await tx.paymentPromise.findFirst({ where: { id, tenantId }, select: { id: true } });
      if (!p) throw new NotFoundException('Promessa não encontrada');
      await tx.paymentPromise.delete({ where: { id } });
    });
  }

  /**
   * Resolve OPEN → KEPT/BROKEN. Compartilha a `tx` do chamador (evita transação aninhada), então
   * pode ser chamado de dentro de outro withTenant (ex.: ao montar o perfil). Idempotente.
   */
  async resolveDue(tx: Prisma.TransactionClient, tenantId: string, debtorId?: string, now: Date = new Date()): Promise<number> {
    const open = await tx.paymentPromise.findMany({
      where: { tenantId, status: 'OPEN', ...(debtorId ? { debtorId } : {}) },
      select: { id: true, debtId: true, promisedAt: true, createdAt: true },
    });
    if (open.length === 0) return 0;
    const debtIds = [...new Set(open.map((p) => p.debtId))];
    const [debts, claims] = await Promise.all([
      tx.debt.findMany({ where: { tenantId, id: { in: debtIds } }, select: { id: true, settledAt: true } }),
      tx.paymentClaim.findMany({ where: { tenantId, debtId: { in: debtIds }, status: 'CONFIRMED' }, select: { debtId: true, claimedAt: true, resolvedAt: true } }),
    ]);
    const settledBy = new Map(debts.map((d) => [d.id, d.settledAt?.getTime() ?? null]));
    const confirmsBy = new Map<string, number[]>();
    for (const c of claims) {
      const t = (c.resolvedAt ?? c.claimedAt).getTime();
      const a = confirmsBy.get(c.debtId) ?? [];
      a.push(t);
      confirmsBy.set(c.debtId, a);
    }
    const nowMs = now.getTime();
    let changed = 0;
    for (const p of open) {
      const deadline = p.promisedAt.getTime() + GRACE_DAYS * DAY;
      const created = p.createdAt.getTime();
      const settledAt = settledBy.get(p.debtId) ?? null;
      // Conta como cumprida se pagou DEPOIS de prometer e ATÉ o prazo + tolerância.
      const paidByDeadline =
        (settledAt != null && settledAt >= created && settledAt <= deadline) ||
        (confirmsBy.get(p.debtId) ?? []).some((t) => t >= created && t <= deadline);
      if (paidByDeadline) {
        await tx.paymentPromise.update({ where: { id: p.id }, data: { status: 'KEPT', resolvedAt: new Date() } });
        changed++;
      } else if (nowMs > deadline) {
        await tx.paymentPromise.update({ where: { id: p.id }, data: { status: 'BROKEN', resolvedAt: new Date() } });
        changed++;
      }
    }
    return changed;
  }

  /** Contagem cumpridas/quebradas de um sobrinho — alimenta o DebtorScore. Assume tx já resolvida. */
  async countsForScore(tx: Prisma.TransactionClient, tenantId: string, debtorId: string): Promise<{ kept: number; broken: number }> {
    const [kept, broken] = await Promise.all([
      tx.paymentPromise.count({ where: { tenantId, debtorId, status: 'KEPT' } }),
      tx.paymentPromise.count({ where: { tenantId, debtorId, status: 'BROKEN' } }),
    ]);
    return { kept, broken };
  }

  private toRow(r: { id: string; debtId: string; amount: Decimal | null; promisedAt: Date; note: string | null; status: string; createdAt: Date; resolvedAt: Date | null }): PromiseRow {
    return {
      id: r.id,
      debtId: r.debtId,
      amount: r.amount != null ? r.amount.toFixed(2) : null,
      promisedAt: r.promisedAt.toISOString(),
      note: r.note,
      status: r.status as PromiseRow['status'],
      createdAt: r.createdAt.toISOString(),
      resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    };
  }
}

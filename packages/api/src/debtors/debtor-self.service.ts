import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { summarize, type DebtSummary } from '@pacific/shared';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';
import { TrackingService } from '../tracking/tracking.service.js';
import { notifyCreditor, brl } from '../notifications/notify.js';

/** Um pagamento registrado: data + total pago acumulado naquele momento (o app calcula o incremento). */
export interface PaymentPoint { at: string; total: string; }
/** Pagamento informado pelo sobrinho, ainda aguardando o padrinho confirmar. */
export interface PendingClaim { amount: string; claimedAt: string; }
export interface MyDebt { id: string; principal: string; dueDate: string; summary: DebtSummary; payments: PaymentPoint[]; pendingClaim: PendingClaim | null; }

@Injectable()
export class DebtorSelfService {
  constructor(
    private readonly scoped: TenantScopedService,
    private readonly tracking: TrackingService,
  ) {}

  async myDebts(tenantId: string, debtorId: string): Promise<MyDebt[]> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const debts = await tx.debt.findMany({ where: { tenantId, debtorId, deletedAt: null }, orderBy: { dueDate: 'asc' } });
      const ids = debts.map((d) => d.id);
      // Histórico de pagamentos a partir do tracking (cada OPERATION_PAID guarda o total acumulado).
      const payEvents = ids.length
        ? await tx.platformEvent.findMany({
            where: { tenantId, targetType: 'debt', targetId: { in: ids }, type: 'OPERATION_PAID' },
            orderBy: { at: 'asc' },
          })
        : [];
      const paymentsByDebt = new Map<string, PaymentPoint[]>();
      for (const e of payEvents) {
        const detail = (e.detail ?? {}) as { paidAmount?: string };
        if (!e.targetId) continue;
        const list = paymentsByDebt.get(e.targetId) ?? [];
        list.push({ at: e.at.toISOString(), total: detail.paidAmount ?? '0.00' });
        paymentsByDebt.set(e.targetId, list);
      }
      // Pagamentos informados ainda pendentes (1 por dívida) — para mostrar "aguardando confirmação".
      const claims = ids.length
        ? await tx.paymentClaim.findMany({ where: { tenantId, debtorId, status: 'PENDING', debtId: { in: ids } } })
        : [];
      const claimByDebt = new Map(claims.map((c) => [c.debtId, c]));
      return debts.map((d) => {
        const claim = claimByDebt.get(d.id);
        return {
          id: d.id,
          principal: d.principal.toFixed(2),
          dueDate: d.dueDate.toISOString(),
          summary: summarize(
            {
              principal: d.principal.toString(),
              rate: d.rate.toString(),
              ratePeriod: d.ratePeriod,
              startDate: d.startDate,
              dueDate: d.dueDate,
            },
            new Date(),
            { paidAmount: d.paidAmount.toString(), settledAt: d.settledAt },
          ),
          payments: paymentsByDebt.get(d.id) ?? [],
          pendingClaim: claim ? { amount: claim.amount.toFixed(2), claimedAt: claim.claimedAt.toISOString() } : null,
        };
      });
    });
  }

  /**
   * O sobrinho INFORMA um pagamento (não move dinheiro): cria um PaymentClaim PENDING que o padrinho
   * confirma ou recusa. Valida que a dívida é dele e não está quitada; impede duplicar um pendente.
   */
  async claimPayment(tenantId: string, debtorId: string, debtId: string, amount: string, note?: string): Promise<void> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const debt = await tx.debt.findFirst({ where: { id: debtId, tenantId, debtorId, deletedAt: null } });
      if (!debt) throw new NotFoundException('Ajuda não encontrada');
      if (debt.settledAt) throw new BadRequestException('Esta ajuda já está quitada.');
      const existing = await tx.paymentClaim.findFirst({ where: { tenantId, debtId, status: 'PENDING' } });
      if (existing) throw new BadRequestException('Já há um pagamento informado aguardando confirmação.');
      const amt = Decimal.max(0, new Decimal(amount || '0'));
      if (amt.lessThanOrEqualTo(0)) throw new BadRequestException('Informe um valor maior que zero.');
      await tx.paymentClaim.create({ data: { tenantId, debtId, debtorId, amount: amt.toFixed(2), note: note?.trim().slice(0, 280) || null } });
      await this.tracking.record(tx, { tenantId, actorType: 'DEBTOR', actorId: debtorId, type: 'PAYMENT_CLAIMED', targetType: 'debt', targetId: debtId, detail: { amount: amt.toFixed(2) } });
      // Notifica o padrinho para confirmar o pagamento avisado.
      const d = await tx.debtor.findUnique({ where: { id: debtorId }, select: { name: true } });
      await notifyCreditor(tx, { tenantId, debtorId, debtId, type: 'PAYMENT_CLAIMED', title: 'Pagamento avisado', body: `${d?.name ?? 'Seu sobrinho'} avisou um pagamento de ${brl(amt.toFixed(2))}. Confirme quando puder.` });
    });
  }

  /** Registra o token de push do dispositivo do sobrinho (app nativo). Envio (FCM) é externo.
   *  Dedup: mantém só o token atual por (devedor, plataforma) — evita acúmulo de tokens stale. */
  async registerPushToken(tenantId: string, debtorId: string, token: string, platform: string): Promise<void> {
    const db = this.scoped.raw();
    await db.deviceToken.deleteMany({ where: { debtorId, platform, token: { not: token } } });
    await db.deviceToken.upsert({
      where: { token },
      create: { tenantId, debtorId, token, platform },
      update: { tenantId, debtorId, platform, lastSeenAt: new Date() },
    });
  }
}

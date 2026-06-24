import { Injectable } from '@nestjs/common';
import { summarize, type DebtSummary } from '@pacific/shared';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';

/** Um pagamento registrado: data + total pago acumulado naquele momento (o app calcula o incremento). */
export interface PaymentPoint { at: string; total: string; }
export interface MyDebt { id: string; principal: string; dueDate: string; summary: DebtSummary; payments: PaymentPoint[]; }

@Injectable()
export class DebtorSelfService {
  constructor(private readonly scoped: TenantScopedService) {}

  async myDebts(tenantId: string, debtorId: string): Promise<MyDebt[]> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const debts = await tx.debt.findMany({ where: { tenantId, debtorId }, orderBy: { dueDate: 'asc' } });
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
      return debts.map((d) => ({
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
      }));
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

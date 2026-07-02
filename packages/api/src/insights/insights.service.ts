import { Injectable } from '@nestjs/common';
import { debtorProfile, type DebtorProfile } from '@pacific/shared';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';

export interface DebtorSignalRow {
  id: string;
  kind: 'INTENT_TO_PAY' | 'NEED_SUPPORT';
  dueDate: string | null;
  note: string | null;
  createdAt: string;
}

/**
 * Camada de inteligência do padrinho. Deriva insights de dados JÁ coletados (quitações, avisos,
 * logins) — sem coletar nada novo. Tudo tenant-scoped (withTenant/RLS). Começa com o perfil
 * comportamental do sobrinho (#2 + #6); cresce para previsão de caixa, radar e sugestões.
 */
@Injectable()
export class InsightsService {
  constructor(private readonly scoped: TenantScopedService) {}

  /** Perfil comportamental de um sobrinho (como costuma pagar, engajamento, melhor horário). */
  async debtorProfile(tenantId: string, debtorId: string, now: Date = new Date()): Promise<DebtorProfile> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const [settled, claims, logins] = await Promise.all([
        tx.debt.findMany({ where: { tenantId, debtorId, deletedAt: null, settledAt: { not: null } }, select: { dueDate: true, settledAt: true } }),
        tx.paymentClaim.findMany({ where: { tenantId, debtorId }, select: { status: true } }),
        tx.debtorLoginEvent.findMany({ where: { tenantId, debtorId, success: true }, select: { at: true }, orderBy: { at: 'desc' }, take: 300 }),
      ]);
      return debtorProfile({
        settled: settled.filter((s): s is { dueDate: Date; settledAt: Date } => s.settledAt != null).map((s) => ({ dueDate: s.dueDate, settledAt: s.settledAt! })),
        claims: claims.map((c) => ({ status: c.status })),
        logins: logins.map((l) => l.at),
        now,
      });
    });
  }

  /** Sinais em aberto do sobrinho (intenção de pagar / pedido de suporte) — ficam ao lado do nome. */
  async openSignals(tenantId: string, debtorId: string): Promise<DebtorSignalRow[]> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const rows = await tx.debtorSignal.findMany({ where: { tenantId, debtorId, resolvedAt: null }, orderBy: { createdAt: 'desc' } });
      return rows.map((r) => ({ id: r.id, kind: r.kind, dueDate: r.dueDate?.toISOString() ?? null, note: r.note, createdAt: r.createdAt.toISOString() }));
    });
  }

  /** Padrinho marca o sinal como resolvido/ciente (some de "ao lado do nome"). */
  async resolveSignal(tenantId: string, id: string): Promise<void> {
    await this.scoped.withTenant(tenantId, (tx) => tx.debtorSignal.updateMany({ where: { id, tenantId }, data: { resolvedAt: new Date() } }));
  }
}

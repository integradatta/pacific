import { Injectable, NotFoundException } from '@nestjs/common';
import type { Notification } from '@pacific/database';
import { daysRemaining } from '@pacific/shared';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';
import type { Page } from '../common/pagination.js';
import { ALERT_TYPES, type AlertType } from './dto/generate-alerts.dto.js';

// Régua de alerta correspondente aos dias até o vencimento (a mais próxima primeiro).
function milestoneFor(days: number): AlertType | null {
  if (days < 0) return 'OVERDUE';
  if (days === 0) return 'DUE_TODAY';
  if (days === 1) return 'DUE_1';
  if (days <= 3) return 'DUE_3';
  if (days <= 7) return 'DUE_7';
  if (days <= 15) return 'DUE_15';
  return null;
}

const ALERT_TITLE: Record<AlertType, string> = {
  DUE_15: 'Vence em 15 dias',
  DUE_7: 'Vence em 7 dias',
  DUE_3: 'Vence em 3 dias',
  DUE_1: 'Vence amanhã',
  DUE_TODAY: 'Vence hoje',
  OVERDUE: 'Dívida vencida',
};

function alertBody(type: AlertType, days: number): string {
  if (type === 'OVERDUE') return `A dívida venceu há ${Math.abs(days)} dia(s).`;
  if (type === 'DUE_TODAY') return 'A dívida vence hoje.';
  if (type === 'DUE_1') return 'A dívida vence amanhã.';
  return `A dívida vence em ${days} dia(s).`;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly scoped: TenantScopedService) {}

  async list(tenantId: string, page: { limit: number; offset: number }): Promise<Page<Notification>> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const [items, total] = await Promise.all([
        tx.notification.findMany({ where: { tenantId }, take: page.limit, skip: page.offset, orderBy: { createdAt: 'desc' } }),
        tx.notification.count({ where: { tenantId } }),
      ]);
      return { items, total, limit: page.limit, offset: page.offset };
    });
  }

  /**
   * Gera alertas de vencimento pelas réguas (15/7/3/0 dias e atraso). Cada dívida recebe a
   * régua correspondente aos dias até o vencimento. Idempotente por (debtId, type) — alertas
   * distintos acumulam conforme a dívida cruza cada marco. `enabled` filtra as réguas ativas
   * (o painel do credor envia só as ligadas); ausente = todas.
   */
  async generateDueNotifications(
    tenantId: string,
    enabled: readonly AlertType[] = ALERT_TYPES,
    asOf: Date = new Date(),
  ): Promise<{ created: number }> {
    const active = new Set<AlertType>(enabled);
    return this.scoped.withTenant(tenantId, async (tx) => {
      const debts = await tx.debt.findMany({ where: { tenantId, deletedAt: null } });
      let created = 0;
      for (const d of debts) {
        const days = daysRemaining(
          { principal: d.principal.toString(), rate: d.rate.toString(), ratePeriod: d.ratePeriod, startDate: d.startDate, dueDate: d.dueDate },
          asOf,
        );
        const type = milestoneFor(days);
        if (!type || !active.has(type)) continue;
        const body = alertBody(type, days);
        await tx.notification.upsert({
          where: { debtId_type: { debtId: d.id, type } },
          create: { tenantId, debtorId: d.debtorId, debtId: d.id, type, title: ALERT_TITLE[type], body },
          update: { body },
        });
        created++;
      }
      return { created };
    });
  }

  /**
   * Resumo SEMANAL da carteira → uma notificação in-app, só para o padrinho que OPTOU por receber
   * (User.weeklyDigestOptIn). Dedup: no máx. 1 por ~semana (a menos de force=true, p/ teste manual).
   * Conteúdo: vencendo em 7d, vencidas e pagamentos aguardando confirmação.
   */
  async generateWeeklyDigest(tenantId: string, opts: { force?: boolean } = {}, now: Date = new Date()): Promise<{ created: number }> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const optedIn = await tx.user.findFirst({ where: { tenantId, role: 'CREDITOR', weeklyDigestOptIn: true }, select: { id: true } });
      if (!optedIn) return { created: 0 };
      if (!opts.force) {
        const sixDaysAgo = new Date(now.getTime() - 6 * 86_400_000);
        const recent = await tx.notification.findFirst({ where: { tenantId, type: 'WEEKLY_DIGEST', createdAt: { gte: sixDaysAgo } }, select: { id: true } });
        if (recent) return { created: 0 };
      }
      const in7d = new Date(now.getTime() + 7 * 86_400_000);
      const [dueSoon, overdue, pendingClaims] = await Promise.all([
        tx.debt.count({ where: { tenantId, deletedAt: null, settledAt: null, dueDate: { gte: now, lte: in7d } } }),
        tx.debt.count({ where: { tenantId, deletedAt: null, settledAt: null, dueDate: { lt: now } } }),
        tx.paymentClaim.count({ where: { tenantId, status: 'PENDING' } }),
      ]);
      const parts: string[] = [];
      if (dueSoon > 0) parts.push(`${dueSoon} ajuda${dueSoon > 1 ? 's' : ''} vencendo nos próximos 7 dias`);
      if (overdue > 0) parts.push(`${overdue} vencida${overdue > 1 ? 's' : ''}`);
      if (pendingClaims > 0) parts.push(`${pendingClaims} pagamento${pendingClaims > 1 ? 's' : ''} aguardando sua confirmação`);
      const body = parts.length > 0 ? `Esta semana: ${parts.join(', ')}.` : 'Tudo tranquilo por aqui esta semana — nada vencendo e nada pendente. 👍';
      await tx.notification.create({ data: { tenantId, type: 'WEEKLY_DIGEST', title: 'Resumo semanal', body } });
      return { created: 1 };
    });
  }

  async markRead(tenantId: string, id: string): Promise<Notification> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const existing = await tx.notification.findFirst({ where: { id, tenantId } });
      if (!existing) throw new NotFoundException('Notificação não encontrada');
      return tx.notification.update({ where: { id }, data: { readAt: new Date() } });
    });
  }
}

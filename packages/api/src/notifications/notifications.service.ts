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
      const debts = await tx.debt.findMany({ where: { tenantId } });
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

  async markRead(tenantId: string, id: string): Promise<Notification> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const existing = await tx.notification.findFirst({ where: { id, tenantId } });
      if (!existing) throw new NotFoundException('Notificação não encontrada');
      return tx.notification.update({ where: { id }, data: { readAt: new Date() } });
    });
  }
}

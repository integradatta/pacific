import { Injectable, NotFoundException } from '@nestjs/common';
import type { Notification } from '@pacific/database';
import { daysRemaining } from '@pacific/shared';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';
import type { Page } from '../common/pagination.js';

type DueType = 'DUE_SOON' | 'OVERDUE';

@Injectable()
export class NotificationsService {
  constructor(private readonly scoped: TenantScopedService) {}

  async list(tenantId: string, page: { limit: number; offset: number }): Promise<Page<Notification>> {
    const db = this.scoped.db(tenantId);
    const [items, total] = await Promise.all([
      db.notification.findMany({ where: { tenantId }, take: page.limit, skip: page.offset, orderBy: { createdAt: 'desc' } }),
      db.notification.count({ where: { tenantId } }),
    ]);
    return { items, total, limit: page.limit, offset: page.offset };
  }

  /** Gera notificações de vencimento/atraso a partir das dívidas do tenant. Idempotente por (debtId, type). */
  async generateDueNotifications(tenantId: string, asOf: Date = new Date()): Promise<{ created: number }> {
    const db = this.scoped.db(tenantId);
    const debts = await db.debt.findMany({ where: { tenantId } });
    let created = 0;
    for (const d of debts) {
      const days = daysRemaining(
        { principal: d.principal.toString(), rate: d.rate.toString(), ratePeriod: d.ratePeriod, startDate: d.startDate, dueDate: d.dueDate },
        asOf,
      );
      let type: DueType | null = null;
      if (days < 0) type = 'OVERDUE';
      else if (days <= 7) type = 'DUE_SOON';
      if (!type) continue;
      const title = type === 'OVERDUE' ? 'Dívida vencida' : 'Vencimento próximo';
      const body = type === 'OVERDUE' ? `A dívida venceu há ${Math.abs(days)} dia(s).` : `A dívida vence em ${days} dia(s).`;
      await db.notification.upsert({
        where: { debtId_type: { debtId: d.id, type } },
        create: { tenantId, debtorId: d.debtorId, debtId: d.id, type, title, body },
        update: { body },
      });
      created++;
    }
    return { created };
  }

  async markRead(tenantId: string, id: string): Promise<Notification> {
    const db = this.scoped.db(tenantId);
    const existing = await db.notification.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Notificação não encontrada');
    return db.notification.update({ where: { id }, data: { readAt: new Date() } });
  }
}

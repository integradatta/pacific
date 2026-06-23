import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';
import { NotificationsService } from './notifications.service.js';

/**
 * Alertas automáticos: diariamente gera as réguas de vencimento (15/7/3/1/hoje/atraso) para todas
 * as carteiras aprovadas e ativas. Idempotente por (debtId, type) — se houver várias instâncias da
 * API, a duplicação é inofensiva (upsert). O credor ainda pode gerar manualmente quando quiser.
 */
@Injectable()
export class NotificationsScheduler {
  private readonly log = new Logger('NotificationsScheduler');

  constructor(
    private readonly scoped: TenantScopedService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async generateForAllTenants(): Promise<void> {
    const tenants = await this.scoped
      .raw()
      .tenant.findMany({ where: { approval: 'APPROVED', status: 'ACTIVE' }, select: { id: true } })
      .catch(() => [] as { id: string }[]);
    let total = 0;
    for (const t of tenants) {
      try {
        const { created } = await this.notifications.generateDueNotifications(t.id);
        total += created;
      } catch (e) {
        this.log.warn(`Falha ao gerar alertas da carteira ${t.id}: ${String(e)}`);
      }
    }
    this.log.log(`Alertas automáticos gerados: ${total} em ${tenants.length} carteiras.`);
  }
}

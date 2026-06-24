import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SuperAdminService } from './super-admin.service.js';

/** Job diário que recalcula as TenantStats (overview do super-admin lê delas). Best-effort. */
@Injectable()
export class StatsScheduler {
  private readonly log = new Logger('StatsScheduler');
  constructor(private readonly admin: SuperAdminService) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async refresh(): Promise<void> {
    try {
      const { tenants } = await this.admin.refreshStats();
      this.log.log(`Stats materializadas atualizadas: ${tenants} carteiras.`);
    } catch (e) {
      this.log.warn(`Falha ao atualizar stats: ${String(e)}`);
    }
  }
}

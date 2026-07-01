import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';
import { NotificationsService } from './notifications.service.js';

/**
 * Resumo semanal da carteira → notificação in-app, só para o padrinho que optou por receber
 * (User.weeklyDigestOptIn). Roda toda segunda-feira às 8h. Idempotente por semana (dedup no
 * generateWeeklyDigest). Best-effort: uma carteira que falha não interrompe as demais.
 */
@Injectable()
export class WeeklyDigestScheduler {
  private readonly log = new Logger('WeeklyDigestScheduler');

  constructor(
    private readonly scoped: TenantScopedService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('0 8 * * 1')
  async run(): Promise<void> {
    const tenants = await this.scoped
      .raw()
      .tenant.findMany({ where: { approval: 'APPROVED', status: 'ACTIVE' }, select: { id: true } })
      .catch(() => [] as { id: string }[]);
    let sent = 0;
    for (const t of tenants) {
      try {
        sent += (await this.notifications.generateWeeklyDigest(t.id)).created;
      } catch (e) {
        this.log.warn(`Falha no resumo semanal da carteira ${t.id}: ${String(e)}`);
      }
    }
    this.log.log(`Resumo semanal: ${sent} enviado(s) em ${tenants.length} carteiras.`);
  }
}

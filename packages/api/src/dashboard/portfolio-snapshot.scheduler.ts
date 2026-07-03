import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';
import { DashboardService } from './dashboard.service.js';

/**
 * Captura diária do snapshot semanal da carteira (tendência do dashboard). A ESCRITA vive aqui, fora
 * do caminho de leitura do dashboard — antes o upsert acontecia a cada abertura da tela. Idempotente
 * por (tenant, semana): rodar todo dia só atualiza o ponto da semana corrente. Best-effort.
 */
@Injectable()
export class PortfolioSnapshotScheduler {
  private readonly log = new Logger('PortfolioSnapshotScheduler');

  constructor(
    private readonly scoped: TenantScopedService,
    private readonly dashboard: DashboardService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  async capture(): Promise<void> {
    const tenants = await this.scoped
      .raw()
      .tenant.findMany({ where: { approval: 'APPROVED', status: 'ACTIVE' }, select: { id: true } })
      // Falha ao listar tenants NÃO pode ser silenciosa: o cron viraria no-op sem ninguém saber.
      .catch((e: unknown) => { this.log.error(`Falha ao listar carteiras — snapshot semanal PULADO: ${String(e)}`); return [] as { id: string }[]; });
    let ok = 0;
    for (const t of tenants) {
      try {
        await this.dashboard.captureWeeklySnapshot(t.id);
        ok += 1;
      } catch (e) {
        this.log.warn(`Falha no snapshot da carteira ${t.id}: ${String(e)}`);
      }
    }
    if (ok > 0) this.log.log(`Snapshot semanal capturado para ${ok} carteira(s).`);
  }
}

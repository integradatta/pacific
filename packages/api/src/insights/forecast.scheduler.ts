import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';
import { ForecastService } from './forecast.service.js';

const monthKey = (d: Date): string => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

/** P7 — no 1º dia do mês: reconcilia o mês anterior (previsto × realizado) e captura o provável do
 *  mês atual. Depois do job de relatórios (05:00). Falha por tenant loga e não interrompe os demais. */
@Injectable()
export class ForecastScheduler {
  private readonly log = new Logger('ForecastScheduler');
  constructor(
    private readonly scoped: TenantScopedService,
    private readonly forecast: ForecastService,
  ) {}

  @Cron('0 6 1 * *') // dia 1 às 06:00
  async run(now: Date = new Date()): Promise<void> {
    const current = monthKey(now);
    const prev = monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15)));
    const tenants = await this.scoped.raw().tenant.findMany({ where: { status: 'ACTIVE' }, select: { id: true } })
      .catch((e: unknown) => { this.log.error(`Falha ao listar carteiras — forecast PULADO: ${String(e)}`); return [] as { id: string }[]; });
    let ok = 0;
    for (const t of tenants) {
      try {
        await this.forecast.reconcile(t.id, prev);
        await this.forecast.capture(t.id, current, now);
        ok++;
      } catch (e) {
        this.log.warn(`Falha no forecast da carteira ${t.id}: ${String(e)}`);
      }
    }
    if (ok > 0) this.log.log(`Forecast: reconciliado ${prev} + capturado ${current} em ${ok} carteiras.`);
  }
}

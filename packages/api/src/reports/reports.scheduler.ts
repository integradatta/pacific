import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';
import { ReportsService, monthKey } from './reports.service.js';

/** REL-1 — Job mensal: no 1º dia do mês, arquiva o relatório do mês ANTERIOR de cada tenant. */
@Injectable()
export class ReportsScheduler {
  private readonly log = new Logger('ReportsScheduler');
  constructor(
    private readonly scoped: TenantScopedService,
    private readonly reports: ReportsService,
  ) {}

  @Cron('0 5 1 * *') // dia 1 às 05:00
  async run(now: Date = new Date()): Promise<void> {
    try {
      const prevMonth = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 15));
      const tenants = await this.scoped.raw().tenant.findMany({ select: { id: true } });
      let n = 0;
      for (const t of tenants) {
        await this.reports.generate(t.id, prevMonth, now)
          .then(() => (n += 1))
          // Falha por tenant não interrompe os demais, mas TEM que aparecer no log (era engolida).
          .catch((e: unknown) => this.log.warn(`Falha no relatório mensal da carteira ${t.id}: ${String(e)}`));
      }
      this.log.log(`Relatórios mensais (${prevMonth}) gerados: ${n}/${tenants.length}.`);
    } catch (e) {
      this.log.warn(`Falha ao gerar relatórios mensais: ${String(e)}`);
    }
  }
}

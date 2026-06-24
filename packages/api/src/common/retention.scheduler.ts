import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';

/**
 * Retenção automática: mantém as tabelas append-only limitadas (custo de banco perto de zero a
 * longo prazo). Diariamente apaga eventos/logins além de RETENTION_DAYS e snapshots muito antigos.
 * AdminAuditLog NÃO é podado (trilha formal). Best-effort: nunca derruba a aplicação.
 */
@Injectable()
export class RetentionScheduler {
  private readonly log = new Logger('RetentionScheduler');
  private readonly eventDays = Number(process.env.RETENTION_DAYS ?? 180);
  private readonly snapshotDays = Number(process.env.SNAPSHOT_RETENTION_DAYS ?? 540);

  constructor(private readonly scoped: TenantScopedService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async prune(now: Date = new Date()): Promise<void> {
    const db = this.scoped.raw();
    const eventCut = new Date(now.getTime() - this.eventDays * 86_400_000);
    const snapCut = new Date(now.getTime() - this.snapshotDays * 86_400_000);
    try {
      const ev = await db.platformEvent.deleteMany({ where: { at: { lt: eventCut } } });
      const sn = await db.portfolioSnapshot.deleteMany({ where: { weekStart: { lt: snapCut } } });
      // DebtorLoginEvent é RLS-forçado → poda por tenant (cron de madrugada; N+1 aceitável).
      let logins = 0;
      const tenants = await db.tenant.findMany({ select: { id: true } });
      for (const t of tenants) {
        const r = await this.scoped.withTenant(t.id, (tx) => tx.debtorLoginEvent.deleteMany({ where: { tenantId: t.id, at: { lt: eventCut } } }));
        logins += r.count;
      }
      this.log.log(`Retenção: ${ev.count} eventos, ${logins} logins, ${sn.count} snapshots removidos (> ${this.eventDays}d).`);
    } catch (e) {
      this.log.warn(`Falha na retenção: ${String(e)}`);
    }
  }
}

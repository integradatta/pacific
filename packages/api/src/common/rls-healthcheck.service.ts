import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';

/**
 * Verifica, no boot, se a RLS está REALMENTE ativa — pega o caso "esqueci de rodar rls.sql" (C2)
 * e "conexão com role BYPASSRLS torna a RLS inócua" (C3). Loga ERRO bem visível (não derruba o
 * processo, p/ não brickar em falha transitória de DB). Desative com RLS_HEALTHCHECK=off.
 */
@Injectable()
export class RlsHealthCheck implements OnApplicationBootstrap {
  private readonly log = new Logger('RlsHealthCheck');
  constructor(private readonly scoped: TenantScopedService) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.RLS_HEALTHCHECK === 'off') return;
    const FORCED = ['Debt', 'Debtor', 'Notification', 'DebtorLoginEvent'];
    try {
      const db = this.scoped.raw();
      const role = await db.$queryRaw<{ bypass: boolean }[]>`SELECT COALESCE(rolbypassrls, false) AS bypass FROM pg_roles WHERE rolname = current_user`;
      if (role[0]?.bypass) {
        this.log.error('⚠ SEGURANÇA: a conexão usa um role com BYPASSRLS — a RLS é IGNORADA. Use um role SEM BYPASSRLS.');
      }
      const rows = await db.$queryRaw<{ relname: string; forced: boolean }[]>`
        SELECT relname, relforcerowsecurity AS forced
        FROM pg_class WHERE relkind = 'r' AND relname = ANY(${FORCED})`;
      const missing = FORCED.filter((t) => !rows.some((r) => r.relname === t && r.forced));
      if (missing.length > 0) {
        this.log.error(`⚠ SEGURANÇA: RLS (FORCE) ausente em: ${missing.join(', ')}. Rode packages/database/src/rls.sql no banco.`);
      } else if (!role[0]?.bypass) {
        this.log.log('RLS verificada: isolamento por tenant ativo (FORCE) e role sem BYPASSRLS.');
      }
    } catch (e) {
      this.log.warn(`RLS healthcheck não pôde rodar: ${String(e)}`);
    }
  }
}

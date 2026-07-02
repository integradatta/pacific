import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';

// Tabelas tenant-scoped que DEVEM ter FORCE ROW LEVEL SECURITY (espelha packages/database/src/rls.sql).
const FORCED_TABLES = [
  'Debtor', 'Debt', 'Notification', 'DebtorLoginEvent', 'PaymentClaim',
  'LocationConsent', 'DebtorPosition', 'LocationPing', 'Geofence', 'GeofenceEvent', 'MonthlyReport',
  'DebtorSignal',
];

/**
 * Verifica, no boot, se a RLS está REALMENTE ativa (C1):
 *  - a role da conexão NÃO pode ter BYPASSRLS (senão a RLS é inócua);
 *  - todas as tabelas tenant-scoped precisam de FORCE ROW LEVEL SECURITY.
 *
 * Por padrão LOGA ERRO bem visível (não derruba o processo — evita brickar em falha transitória).
 * Com RLS_STRICT=on, **aborta o boot** se a RLS estiver inválida (recomendado em produção APÓS
 * apontar a DATABASE_URL para a role dedicada — ver packages/database/scripts/create-app-role.sql).
 * Desative tudo com RLS_HEALTHCHECK=off.
 */
@Injectable()
export class RlsHealthCheck implements OnApplicationBootstrap {
  private readonly log = new Logger('RlsHealthCheck');
  constructor(private readonly scoped: TenantScopedService) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.RLS_HEALTHCHECK === 'off') return;
    const strict = process.env.RLS_STRICT === 'on';

    let bypass = false;
    let missing: string[] = [];
    try {
      const db = this.scoped.raw();
      const role = await db.$queryRaw<{ bypass: boolean }[]>`SELECT COALESCE(rolbypassrls, false) AS bypass FROM pg_roles WHERE rolname = current_user`;
      bypass = role[0]?.bypass ?? false;
      const rows = await db.$queryRaw<{ relname: string; forced: boolean }[]>`
        SELECT relname, relforcerowsecurity AS forced
        FROM pg_class WHERE relkind = 'r' AND relname = ANY(${FORCED_TABLES})`;
      missing = FORCED_TABLES.filter((t) => !rows.some((r) => r.relname === t && r.forced));
    } catch (e) {
      // Falha transitória ao consultar o catálogo: não derruba o boot mesmo em strict.
      this.log.warn(`RLS healthcheck não pôde rodar: ${String(e)}`);
      return;
    }

    const problems: string[] = [];
    if (bypass) problems.push('a conexão usa um role com BYPASSRLS (a RLS é IGNORADA)');
    if (missing.length > 0) problems.push(`FORCE RLS ausente em: ${missing.join(', ')}`);

    if (problems.length === 0) {
      this.log.log('RLS verificada: isolamento por tenant ativo (FORCE) em todas as tabelas e role sem BYPASSRLS.');
      return;
    }

    const msg = `⚠ SEGURANÇA/RLS: ${problems.join(' | ')}. Veja packages/database/scripts/create-app-role.sql e src/rls.sql.`;
    this.log.error(msg);
    if (strict) {
      // Falha dura: melhor não subir do que servir com isolamento de tenant inerte.
      throw new Error(`RLS inválida — abortando o boot (RLS_STRICT=on). ${msg}`);
    }
    this.log.error('RLS_STRICT não está "on": subindo mesmo assim. Defina RLS_STRICT=on em produção após corrigir.');
  }
}

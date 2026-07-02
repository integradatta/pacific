-- Row-Level Security: isolamento por tenant (defesa em profundidade — ATIVA).
--
-- Como a app ativa: cada request tenant-scoped roda dentro de uma transação
-- (TenantScopedService.withTenant) que executa, parametrizado:
--   SELECT set_config('app.current_tenant', '<tenantId>', true);   -- escopo de transação
-- As policies abaixo filtram por esse valor (USING) e impedem gravar fora do
-- tenant (WITH CHECK). FORCE garante que nem o owner da tabela burla a policy.
--
-- ORDEM DE APLICAÇÃO: aplique este arquivo APÓS as migrações E APÓS o seed
-- (o seed usa um PrismaClient sem contexto de tenant; com a RLS ativa a WITH CHECK
-- bloquearia os inserts dele). Em produção, rode após migrate deploy.
--   psql "$DATABASE_URL" -f packages/database/src/rls.sql   (ou SQL editor do Supabase)

ALTER TABLE "Debtor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Debtor" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_debtor ON "Debtor"
  USING ("tenantId" = current_setting('app.current_tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant', true));

ALTER TABLE "Debt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Debt" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_debt ON "Debt"
  USING ("tenantId" = current_setting('app.current_tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant', true));

ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_notification ON "Notification"
  USING ("tenantId" = current_setting('app.current_tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant', true));

-- DebtorAccess is intentionally OUTSIDE RLS — same rationale as User/Tenant.
-- The magic-link login flow looks up a row by tokenHash before any tenant context
-- is established (there is no authenticated session yet at that point).
-- The table contains only a token hash + scalar ids; no sensitive debt/PII data.
-- Tenant isolation is enforced at the application layer (service validates tenantId
-- after the token lookup resolves).

ALTER TABLE "DebtorLoginEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DebtorLoginEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_debtor_login_event ON "DebtorLoginEvent"
  USING ("tenantId" = current_setting('app.current_tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant', true));

ALTER TABLE "PaymentClaim" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentClaim" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_payment_claim ON "PaymentClaim"
  USING ("tenantId" = current_setting('app.current_tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant', true));

-- Módulo de Localização (compartilhamento consentido) — todas tenant-scoped.
ALTER TABLE "LocationConsent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LocationConsent" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_locationconsent ON "LocationConsent"
  USING ("tenantId" = current_setting('app.current_tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant', true));

ALTER TABLE "DebtorPosition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DebtorPosition" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_debtorposition ON "DebtorPosition"
  USING ("tenantId" = current_setting('app.current_tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant', true));

ALTER TABLE "LocationPing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LocationPing" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_locationping ON "LocationPing"
  USING ("tenantId" = current_setting('app.current_tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant', true));

ALTER TABLE "Geofence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Geofence" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_geofence ON "Geofence"
  USING ("tenantId" = current_setting('app.current_tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant', true));

ALTER TABLE "GeofenceEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GeofenceEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_geofenceevent ON "GeofenceEvent"
  USING ("tenantId" = current_setting('app.current_tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant', true));

ALTER TABLE "MonthlyReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MonthlyReport" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_monthlyreport ON "MonthlyReport"
  USING ("tenantId" = current_setting('app.current_tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant', true));

ALTER TABLE "DebtorSignal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DebtorSignal" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_debtorsignal ON "DebtorSignal";
CREATE POLICY tenant_isolation_debtorsignal ON "DebtorSignal"
  USING ("tenantId" = current_setting('app.current_tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant', true));

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- Tabelas GLOBAIS (não tenant-scoped) — a migration 14 ligou RLS deny-by-default (sem FORCE) nelas
-- como defesa contra PostgREST/anon. Isso funcionava com a API conectando como DONA das tabelas
-- (postgres ignora RLS sem FORCE). Com a role de runtime `pacific_app` (NÃO dona, C1), o deny-by-
-- default passa a bloqueá-la → SELECT "User" volta 0 linhas e /auth/me quebra. Estas policies
-- liberam SÓ a `pacific_app` (o controle de acesso dessas tabelas é feito na camada de aplicação);
-- anon/authenticated continuam bloqueados (foram REVOKE na mig 14 e não têm policy). Idempotente.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'User','Tenant','AdminAuditLog','PlatformEvent',
    'TenantStats','PortfolioSnapshot','DeviceToken','DebtorAccess'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS app_full_access ON %I;', t);
    EXECUTE format(
      'CREATE POLICY app_full_access ON %I FOR ALL TO pacific_app '
      'USING (true) WITH CHECK (true);', t);
  END LOOP;
END $$;

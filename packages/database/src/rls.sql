-- Row-Level Security: isolamento por tenant (defesa em profundidade).
-- A aplicação deve definir o tenant corrente por request com:
--   SET LOCAL app.current_tenant = '<tenantId>';
-- Aplicar este arquivo após as migrações (ex.: psql "$DATABASE_URL" -f packages/database/src/rls.sql
-- ou via SQL editor do Supabase).

ALTER TABLE "Debtor" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_debtor ON "Debtor"
  USING ("tenantId" = current_setting('app.current_tenant', true));

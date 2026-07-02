-- #3 Sinais do sobrinho (intenção de resolver até uma data / pedido de suporte) + tipos de
-- notificação correspondentes. Tenant-scoped com RLS FORCE (isolado como as demais tabelas).

DO $$ BEGIN
  CREATE TYPE "DebtorSignalKind" AS ENUM ('INTENT_TO_PAY', 'NEED_SUPPORT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "DebtorSignal" (
  "id"         TEXT NOT NULL,
  "tenantId"   TEXT NOT NULL,
  "debtorId"   TEXT NOT NULL,
  "debtId"     TEXT,
  "kind"       "DebtorSignalKind" NOT NULL,
  "dueDate"    TIMESTAMP(3),
  "note"       TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "DebtorSignal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DebtorSignal_tenantId_debtorId_resolvedAt_idx"
  ON "DebtorSignal" ("tenantId", "debtorId", "resolvedAt");

-- RLS: isolamento por tenant (FORCE — nem a role dona burla).
ALTER TABLE "DebtorSignal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DebtorSignal" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_debtorsignal ON "DebtorSignal";
CREATE POLICY tenant_isolation_debtorsignal ON "DebtorSignal"
  USING ("tenantId" = current_setting('app.current_tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant', true));

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DEBTOR_INTENT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DEBTOR_SUPPORT';

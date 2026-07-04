-- #4 Promessas rastreadas: o padrinho registra "combinou pagar até <data>" e o desfecho é
-- resolvido automaticamente (cumprida / quebrada). Alimenta o DebtorScore. Tenant-scoped (RLS FORCE).

DO $$ BEGIN
  CREATE TYPE "PromiseStatus" AS ENUM ('OPEN', 'KEPT', 'BROKEN');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "PaymentPromise" (
  "id"         TEXT NOT NULL,
  "tenantId"   TEXT NOT NULL,
  "debtorId"   TEXT NOT NULL,
  "debtId"     TEXT NOT NULL,
  "amount"     DECIMAL(14,2),
  "promisedAt" TIMESTAMP(3) NOT NULL,
  "note"       TEXT,
  "status"     "PromiseStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "PaymentPromise_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PaymentPromise_tenantId_debtorId_status_idx"
  ON "PaymentPromise" ("tenantId", "debtorId", "status");
CREATE INDEX IF NOT EXISTS "PaymentPromise_tenantId_debtId_status_idx"
  ON "PaymentPromise" ("tenantId", "debtId", "status");

-- RLS: isolamento por tenant (FORCE — nem a role dona burla).
ALTER TABLE "PaymentPromise" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentPromise" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_paymentpromise ON "PaymentPromise";
CREATE POLICY tenant_isolation_paymentpromise ON "PaymentPromise"
  USING ("tenantId" = current_setting('app.current_tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant', true));

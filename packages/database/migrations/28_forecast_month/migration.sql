-- P7 — Previsto × realizado (acurácia honesta). Tabela tenant-scoped com RLS FORCE. Aditiva.
CREATE TABLE IF NOT EXISTS "ForecastMonth" (
  "id"           TEXT NOT NULL,
  "tenantId"     TEXT NOT NULL,
  "month"        TEXT NOT NULL,
  "predicted"    DECIMAL(14,2) NOT NULL,
  "capturedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "realized"     DECIMAL(14,2),
  "reconciledAt" TIMESTAMP(3),
  CONSTRAINT "ForecastMonth_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ForecastMonth_tenantId_month_key" ON "ForecastMonth" ("tenantId", "month");
CREATE INDEX IF NOT EXISTS "ForecastMonth_tenantId_month_idx" ON "ForecastMonth" ("tenantId", "month");

-- RLS: isolamento por tenant (FORCE — nem a role dona burla).
ALTER TABLE "ForecastMonth" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ForecastMonth" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_forecastmonth ON "ForecastMonth";
CREATE POLICY tenant_isolation_forecastmonth ON "ForecastMonth"
  USING ("tenantId" = current_setting('app.current_tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant', true));

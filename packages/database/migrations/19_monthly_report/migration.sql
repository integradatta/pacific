-- REL-1 — Relatório mensal automático (in-app). Um por (tenant, mês). Ver dashboard/intelligence.
CREATE TABLE "MonthlyReport" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "totalLent" DECIMAL(14,2) NOT NULL,
  "totalReceivable" DECIMAL(14,2) NOT NULL,
  "totalReceived" DECIMAL(14,2) NOT NULL,
  "totalOverdue" DECIMAL(14,2) NOT NULL,
  "opsActive" INTEGER NOT NULL,
  "opsSettled" INTEGER NOT NULL,
  "healthScore" INTEGER NOT NULL,
  "healthState" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MonthlyReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MonthlyReport_tenantId_month_key" ON "MonthlyReport"("tenantId", "month");
CREATE INDEX "MonthlyReport_tenantId_month_idx" ON "MonthlyReport"("tenantId", "month");

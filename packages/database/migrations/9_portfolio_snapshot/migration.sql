-- Snapshot semanal da saúde da carteira (tendência + resumo da semana). In-app, sem envio externo.
CREATE TABLE IF NOT EXISTS "PortfolioSnapshot" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "weekStart" TIMESTAMP(3) NOT NULL,
  "healthScore" INTEGER NOT NULL,
  "state" TEXT NOT NULL,
  "receivable" DECIMAL(14,2) NOT NULL,
  "overdue" DECIMAL(14,2) NOT NULL,
  "expectedProfit" DECIMAL(14,2) NOT NULL,
  "opsActive" INTEGER NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortfolioSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PortfolioSnapshot_tenantId_weekStart_key" ON "PortfolioSnapshot" ("tenantId", "weekStart");
CREATE INDEX IF NOT EXISTS "PortfolioSnapshot_tenantId_weekStart_idx" ON "PortfolioSnapshot" ("tenantId", "weekStart");

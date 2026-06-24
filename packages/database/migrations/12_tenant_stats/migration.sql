-- Estatísticas materializadas por tenant (overview do super-admin lê daqui). Aditivo/idempotente.
CREATE TABLE IF NOT EXISTS "TenantStats" (
  "tenantId" TEXT NOT NULL,
  "opsTotal" INTEGER NOT NULL DEFAULT 0,
  "opsActive" INTEGER NOT NULL DEFAULT 0,
  "opsOverdue" INTEGER NOT NULL DEFAULT 0,
  "totalLent" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalReceivable" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalReceived" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "loginsToday" INTEGER NOT NULL DEFAULT 0,
  "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantStats_pkey" PRIMARY KEY ("tenantId")
);

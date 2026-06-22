-- Módulo de localização por compartilhamento CONSENTIDO (voluntário, revogável).
-- Aditivo e idempotente. Consentimento no Debtor + histórico de posições em LocationPing.

DO $$ BEGIN
  CREATE TYPE "ConsentState" AS ENUM ('NEVER', 'GRANTED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "Debtor" ADD COLUMN IF NOT EXISTS "locationConsent" "ConsentState" NOT NULL DEFAULT 'NEVER';
ALTER TABLE "Debtor" ADD COLUMN IF NOT EXISTS "locationConsentAt" TIMESTAMP(3);
ALTER TABLE "Debtor" ADD COLUMN IF NOT EXISTS "locationRevokedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "LocationPing" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "debtorId" TEXT NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "accuracy" DOUBLE PRECISION,
  "battery" INTEGER,
  "recordedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LocationPing_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LocationPing_tenantId_idx" ON "LocationPing"("tenantId");
CREATE INDEX IF NOT EXISTS "LocationPing_debtorId_recordedAt_idx" ON "LocationPing"("debtorId", "recordedAt");

DO $$ BEGIN
  ALTER TABLE "LocationPing" ADD CONSTRAINT "LocationPing_debtorId_tenantId_fkey"
    FOREIGN KEY ("debtorId", "tenantId") REFERENCES "Debtor"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

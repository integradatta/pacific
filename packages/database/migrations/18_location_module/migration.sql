-- ── Fase 1 do Módulo de Localização (compartilhamento consentido) ─────────────────────────────
-- Ver docs/LOCATION_DESIGN.md. Tabelas tenant-scoped; políticas RLS aplicadas à parte (rls.sql).

ALTER TYPE "PlatformEventType" ADD VALUE IF NOT EXISTS 'LOCATION_CONSENT';

CREATE TYPE "LocationConsentState" AS ENUM ('NEVER', 'DECLINED', 'GRANTED', 'REVOKED');

CREATE TABLE "LocationConsent" (
  "debtorId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "state" "LocationConsentState" NOT NULL DEFAULT 'NEVER',
  "consentText" TEXT,
  "grantedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LocationConsent_pkey" PRIMARY KEY ("debtorId")
);
CREATE INDEX "LocationConsent_tenantId_state_idx" ON "LocationConsent"("tenantId", "state");

CREATE TABLE "DebtorPosition" (
  "debtorId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "lat" DECIMAL(9,6) NOT NULL,
  "lng" DECIMAL(9,6) NOT NULL,
  "accuracy" INTEGER,
  "battery" INTEGER,
  "recordedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DebtorPosition_pkey" PRIMARY KEY ("debtorId")
);
CREATE INDEX "DebtorPosition_tenantId_idx" ON "DebtorPosition"("tenantId");

CREATE TABLE "LocationPing" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "debtorId" TEXT NOT NULL,
  "lat" DECIMAL(9,6) NOT NULL,
  "lng" DECIMAL(9,6) NOT NULL,
  "accuracy" INTEGER,
  "battery" INTEGER,
  "recordedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LocationPing_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LocationPing_tenantId_debtorId_recordedAt_idx" ON "LocationPing"("tenantId", "debtorId", "recordedAt");

CREATE TABLE "Geofence" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "lat" DECIMAL(9,6) NOT NULL,
  "lng" DECIMAL(9,6) NOT NULL,
  "radiusM" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Geofence_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Geofence_tenantId_idx" ON "Geofence"("tenantId");

CREATE TABLE "GeofenceEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "debtorId" TEXT NOT NULL,
  "geofenceId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GeofenceEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GeofenceEvent_tenantId_debtorId_occurredAt_idx" ON "GeofenceEvent"("tenantId", "debtorId", "occurredAt");

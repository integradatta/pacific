-- Camada de tracking: log unificado de eventos da plataforma. Aditivo e idempotente.
-- GLOBAL (sem RLS) — o super-admin lê cross-tenant.

DO $$ BEGIN
  CREATE TYPE "PlatformEventType" AS ENUM (
    'LOGIN','LOGOUT','LOGIN_FAILED','LINK_USED','LINK_CREATED','LINK_ROTATED',
    'ACCESS_REVOKED','ACCESS_REACTIVATED','OPERATION_CREATED','OPERATION_UPDATED',
    'OPERATION_PAID','CLIENT_CREATED','TENANT_APPROVED','TENANT_SUSPENDED','IMPORTANT'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "PlatformEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "actorType" TEXT NOT NULL,
  "actorId" TEXT,
  "type" "PlatformEventType" NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "detail" JSONB,
  "ip" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PlatformEvent_at_idx" ON "PlatformEvent"("at");
CREATE INDEX IF NOT EXISTS "PlatformEvent_tenantId_at_idx" ON "PlatformEvent"("tenantId", "at");
CREATE INDEX IF NOT EXISTS "PlatformEvent_type_at_idx" ON "PlatformEvent"("type", "at");

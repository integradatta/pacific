-- Super-admin: gate de aprovação de tenants + auditoria de ações. Aditivo e idempotente.
-- Tenants existentes recebem APPROVED (default) → não quebram; novos credores entram PENDING.

DO $$ BEGIN
  CREATE TYPE "TenantApproval" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "approval" "TenantApproval" NOT NULL DEFAULT 'APPROVED';

CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
  "id" TEXT NOT NULL,
  "actorSupabaseId" TEXT NOT NULL,
  "actorEmail" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "detail" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

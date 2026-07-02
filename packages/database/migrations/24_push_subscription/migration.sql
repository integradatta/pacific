-- Web Push (VAPID) do padrinho. Tabela GLOBAL (como DeviceToken): RLS deny-by-default + policy
-- app_full_access (adicionada no rls.sql). Filtro por tenantId feito na camada de aplicação.
CREATE TABLE IF NOT EXISTS "PushSubscription" (
  "id"         TEXT NOT NULL,
  "tenantId"   TEXT NOT NULL,
  "supabaseId" TEXT NOT NULL,
  "endpoint"   TEXT NOT NULL,
  "p256dh"     TEXT NOT NULL,
  "auth"       TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription" ("endpoint");
CREATE INDEX IF NOT EXISTS "PushSubscription_tenantId_idx" ON "PushSubscription" ("tenantId");

-- RLS deny-by-default (bloqueia anon/PostgREST). A policy que libera a pacific_app está no rls.sql.
ALTER TABLE "PushSubscription" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_full_access ON "PushSubscription";
CREATE POLICY app_full_access ON "PushSubscription" FOR ALL TO pacific_app USING (true) WITH CHECK (true);

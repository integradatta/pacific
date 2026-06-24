-- ── Lockdown de acesso direto (PostgREST / anon key pública) ─────────────────────
-- A anon key do Supabase é PÚBLICA (vai no bundle do web) e o PostgREST expõe as tabelas
-- do schema public. Sem isto, tabelas SEM RLS (User, Tenant, PlatformEvent, TenantStats,
-- DeviceToken, etc.) seriam legíveis/graváveis direto por qualquer um com a anon key.
--
-- A API NÃO usa anon/authenticated: conecta como o role dono (postgres) via DATABASE_URL.
-- Por isso revogamos TODO acesso desses roles do schema public e ligamos RLS deny-by-default
-- nas tabelas globais (sem FORCE → o owner/a API continua lendo; PostgREST fica bloqueado).
-- As tabelas tenant-scoped (Debtor/Debt/Notification/DebtorLoginEvent) usam FORCE + policy em
-- packages/database/src/rls.sql. Idempotente.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated;
  END IF;
END $$;

-- RLS deny-by-default (sem FORCE) nas tabelas globais — defesa em profundidade caso um GRANT volte.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdminAuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantStats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PortfolioSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeviceToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DebtorAccess" ENABLE ROW LEVEL SECURITY;

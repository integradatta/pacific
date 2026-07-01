-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- C1 — Role dedicada da aplicação SEM BYPASSRLS (corrige "RLS inerte").
-- Rode UMA vez como admin (role `postgres`) no Supabase → SQL Editor.
-- Depois aponte DATABASE_URL (runtime) para ESTA role; mantenha DIRECT_URL no role privilegiado
-- (as migrations precisam de DDL). Veja docs/RLS_RUNBOOK.md.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

-- 1) Cria a role de login, SEM superuser e SEM bypassrls. TROQUE a senha.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pacific_app') THEN
    CREATE ROLE pacific_app LOGIN PASSWORD 'TROQUE_ESTA_SENHA_FORTE' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;
-- Garante (idempotente) que a role nunca burla a RLS.
ALTER ROLE pacific_app NOSUPERUSER NOBYPASSRLS;

-- 2) Acesso DML (sem DDL) ao schema da aplicação.
GRANT USAGE ON SCHEMA public TO pacific_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pacific_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pacific_app;

-- 3) Tabelas/sequences criadas por FUTURAS migrations (rodadas como `postgres`) herdam os grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pacific_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO pacific_app;

-- 4) Verificação — bypass deve ser FALSE:
-- SELECT rolname, rolbypassrls, rolsuper FROM pg_roles WHERE rolname = 'pacific_app';
--
-- A app define o tenant por transação via set_config('app.current_tenant', ..., true), permitido a
-- qualquer role (GUC do namespace 'app.'). As policies em src/rls.sql filtram por esse valor.

-- ============================================================================
-- RLS do schema geo — isolamento por tenant (defesa em profundidade).
-- O TenantGuard extrai tenant_id do JWT e executa, por transação:
--   SELECT set_config('app.current_tenant', '<tenant_id>', true);
-- As policies filtram por esse valor. FORCE garante que nem o owner burla.
-- Aplicar APÓS 0001_geo_init.sql (e após seeds, se houver — o seed roda sem contexto
-- de tenant e a WITH CHECK bloquearia inserts; seedar antes da RLS).
-- geocoding_cache fica FORA da RLS (dado de referência global, sem tenant).
-- ============================================================================

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'group','group_member','group_invite','user_device','location_point',
    'daily_route_summary','frequent_place','geofence','geofence_event','consent_log'
  ] LOOP
    EXECUTE format('ALTER TABLE geo.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE geo.%I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON geo.%I;', t);
    EXECUTE format($p$
      CREATE POLICY tenant_isolation ON geo.%I
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
    $p$, t);
  END LOOP;
END $$;

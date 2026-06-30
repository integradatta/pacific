# Runbook — Tornar a RLS efetiva (C1)

> Objetivo: a conexão de runtime da API usar uma role **sem BYPASSRLS**, para que o `FORCE ROW LEVEL
> SECURITY` (em `packages/database/src/rls.sql`) realmente isole os tenants — defesa em profundidade
> além do `where tenantId` no código.

## Por que
Hoje a API provavelmente conecta como `postgres` (role com `BYPASSRLS` no Supabase) → a RLS é
**ignorada** e o isolamento depende 100% de cada query ter o `where tenantId`. Uma query esquecida =
vazamento cross-tenant. Com uma role sem bypass, um erro de código deixa de ser incidente de dados.

## Passos (manuais, no Supabase)

1. **Criar a role dedicada** (uma vez): SQL Editor do Supabase → cole e rode
   `packages/database/scripts/create-app-role.sql` (troque a senha por uma forte).

2. **Confirmar que não tem bypass**:
   ```sql
   SELECT rolname, rolbypassrls, rolsuper FROM pg_roles WHERE rolname = 'pacific_app';
   -- rolbypassrls deve ser FALSE
   ```

3. **Garantir que `rls.sql` foi aplicado** (FORCE + policies em todas as tabelas tenant):
   - rode `packages/database/src/rls.sql` no SQL Editor (idempotente nas partes de policy;
     as migrations 14–19 já habilitaram boa parte). Se já aplicou, pode pular.

4. **Apontar a `DATABASE_URL` (runtime) para a nova role** no Railway (serviço `pacific-api`):
   - **Mantenha** `DIRECT_URL` no role privilegiado (`postgres`) — as migrations precisam de DDL.
   - Troque **só** `DATABASE_URL` para conectar como `pacific_app`.
   - No Supabase, a string do pooler tem o formato com sufixo do projeto. Pegue a connection string
     em *Project Settings → Database → Connection string* e substitua o usuário/senha por
     `pacific_app` / a senha criada. Se o pooler (6543) recusar a role custom, use a **conexão de
     sessão (5432)** para a `DATABASE_URL` desta role.

5. **Ativar o modo estrito** (depois que os passos acima estiverem certos): no Railway, defina
   ```
   RLS_STRICT=on
   ```
   Com isso, o `RlsHealthCheck` no boot **aborta** se detectar BYPASSRLS ou FORCE ausente — vira um
   invariante de produção (melhor não subir do que servir com isolamento inerte).

## Validação
- No deploy, os logs da API devem mostrar:
  `RLS verificada: isolamento por tenant ativo (FORCE) em todas as tabelas e role sem BYPASSRLS.`
- Se aparecer `⚠ SEGURANÇA/RLS: ...`, a role ainda tem bypass ou falta FORCE — revise os passos.
- Teste funcional rápido: o app deve continuar funcionando normalmente (as queries já passam o
  tenant). Se algo retornar vazio indevidamente, verifique se a query roda dentro de `withTenant`.

## Rollback
- Se algo quebrar, basta **voltar a `DATABASE_URL`** para o role anterior e remover `RLS_STRICT`.
  Nenhuma migration é necessária para reverter.

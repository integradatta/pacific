# Relatório — Validação E2E da Row-Level Security (RLS)

**Data:** 2026-06-17 · **Branch:** `feat/fase-1` · **Resultado: ✅ 6/6 checks passaram**

## Objetivo

Comprovar, contra um **Postgres real**, que a RLS isola dados por tenant de fato (não apenas na camada de aplicação), antes do merge da Fase 1.

## Ambiente

- macOS 15.7 (x86_64), sem Docker/Supabase disponíveis neste ambiente.
- **Postgres 17 real** provisionado via `embedded-postgres` (binário nativo, efêmero, sem instalação no sistema).
- **Crítico:** a validação conecta como **role `pacific_app` (NOSUPERUSER, não-owner)** — superusuários *bypassam* RLS, então testar como superuser não provaria nada. `pacific_app` está sujeito às policies.

## Método

1. Aplica `packages/database/migrations/0_init/migration.sql` (schema).
2. **Seed de 2 tenants** (antes da RLS): A = `Carteira A` (3 devedores + 3 dívidas), B = `Carteira B` (2 devedores + 2 dívidas).
3. Aplica `packages/database/src/rls.sql` (`ENABLE` + `FORCE ROW LEVEL SECURITY` + policies `USING`/`WITH CHECK` em Debtor/Debt/Notification).
4. Cria role `pacific_app` + grants de DML.
5. Conecta como `pacific_app` e valida, **replicando `TenantScopedService.withTenant`** (transação + `set_config('app.current_tenant', $1, true)`).

## Resultados

| # | Verificação | Esperado | Obtido | Status |
|---|---|---|---|---|
| a | Tenant A enxerga apenas A | 3 devedores, só tenant A | 3, só A | ✅ PASS |
| b | Tenant B enxerga apenas B | 2 devedores, só tenant B | 2, só B | ✅ PASS |
| c | Sem `app.current_tenant` configurado | 0 linhas | 0 linhas | ✅ PASS |
| d | Leitura cross-tenant (A lê devedor de B por id) | `null` | `null` | ✅ PASS |
| e | Escrita cross-tenant (INSERT `tenantId=B` sob contexto A) | bloqueada | `WITH CHECK` rejeitou | ✅ PASS |
| f | Isolamento também em `Debt` | A=3 / B=2 dívidas | A=3 / B=2 | ✅ PASS |

**Conclusão:** a RLS está **efetiva**. O isolamento de leitura por tenant, o bloqueio de leitura e escrita cross-tenant, e o "sem contexto ⇒ nenhum dado" funcionam no banco. `FORCE` garante que nem o owner da tabela burla; o app de produção (Supabase) conecta como role não-superuser, exatamente como neste teste.

## Como reproduzir

```bash
# instala o harness sem poluir as deps commitadas (cache temporário evita problema de permissão do ~/.npm)
npm i --no-save embedded-postgres --cache /tmp/npm-cache-pac
npx tsx packages/database/rls-e2e.ts   # imprime PASS/FAIL por check; exit 0 se tudo passar
```

Harness: `packages/database/rls-e2e.ts` (não depende do ambiente ter Docker/Postgres).

## Ressalvas

- `app.current_tenant` é um GUC custom de transação (escopo local), definido por request dentro de `withTenant`; fora de uma transação tenant-scoped, nenhuma linha é visível (fail-closed).
- Tabelas sob RLS: `Debtor`, `Debt`, `Notification`. `User`/`Tenant` ficam fora (acesso global no provisionamento/resgate); o isolamento delas é de camada de aplicação por design.

# Relatório — Validação E2E do login do devedor por link mágico

**Data:** 2026-06-18 · **Branch:** `feat/debtor-magic-link` · **Resultado: ✅ 7/7 checks**

## Objetivo

Provar, contra um **Postgres real**, o fluxo de acesso do devedor por link individual (provisionado pelo credor): resolução, segredo em repouso, revogação, rotação e isolamento — replicando os serviços reais (provisionamento, exchange, self-view).

## Ambiente

- Postgres 17 real via `embedded-postgres` (efêmero), conectado como role **`pacific_app` (NOSUPERUSER)** — sujeito à RLS.
- Replica `TenantScopedService.withTenant` (transação + `set_config('app.current_tenant', …)`), o lookup pré-auth em `DebtorAccess` (fora da RLS), e o hash sha256 do token.

## Resultados

| # | Verificação | Obtido | Status |
|---|---|---|---|
| 1 | Link válido resolve o devedor certo (tenant + debtorId) | resolveu Ana@A | ✅ |
| 2 | Token guardado com **hash** (claro não persiste) | `tokenHash == sha256(token)`, `!= token` | ✅ |
| 3 | Token desconhecido não resolve | `null` | ✅ |
| 4 | Acesso **revogado** é rejeitado | `null` após revoke | ✅ |
| 5 | **Rotação**: token antigo morre, novo funciona | antigo `null`, novo → Bob | ✅ |
| 6 | Self-view isolado: vê só a própria; dívida de outro tenant invisível (RLS) | própria=1, cross=0 | ✅ |
| 7 | Auditoria de login isolada por tenant (RLS) | A vê só de A; B só de B | ✅ |

**Conclusão:** o fluxo do link é seguro e isolado no banco real. A credencial nunca persiste em claro; revogação e rotação funcionam por devedor; o devedor enxerga apenas a própria dívida e a auditoria é isolada por tenant pela RLS.

## Bug encontrado e corrigido

A validação **pegou um bug real**: o `migrations/0_init/migration.sql` (regenerado nesta branch) continha a caixa "Update available" do Prisma CLI, capturada no `> migration.sql` — texto não-SQL que **quebraria `migrate deploy` em produção**. Corrigido regenerando com `PRISMA_HIDE_UPDATE_MESSAGE` (commit de fix nesta branch).

## Como reproduzir

```bash
npm i --no-save embedded-postgres --cache /tmp/npm-cache-pac
npx tsx packages/database/magic-link-e2e.ts   # 7/7, exit 0
```
Harness: `packages/database/magic-link-e2e.ts`.

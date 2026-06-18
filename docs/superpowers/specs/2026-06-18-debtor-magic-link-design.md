# Design — Acesso do devedor por link individual (provisionado pelo credor)

**Data:** 2026-06-18 · **Status:** aprovado em direção (link mágico, sem senha); detalhe técnico abaixo.

## Decisão

O credor **provisiona cada devedor** e recebe um **link de acesso individual** para enviar àquela pessoa. O devedor abre o link e entra — **sem senha**. Premium, individual e prático para o credor. Substitui o onboarding por `org_code` self-service. Super-admin e credor seguem no Supabase.

## Modelo de dados

- **`DebtorAccess`** (NOVA, **fora da RLS** — permite o lookup pré-autenticação no resgate do link):
  `id`, `debtorId` (unique), `tenantId`, `tokenHash` (sha256 do token do link, unique/indexado), `active` (revogação), `lastSeenAt?`, `rotatedAt?`, `createdAt`.
  O **token em claro só existe no link**, exibido **uma vez** ao credor. No banco guardamos só o hash.
- **`DebtorLoginEvent`** (auditoria, sob RLS por `tenantId`): `id`, `debtorId`, `tenantId`, `success`, `at`, `ip?`.
- `Debtor` permanece sob RLS; `userId` (Supabase) deixa de ser usado por devedores.

## Fluxos

**Credor (Supabase, CREDITOR, tenant-scoped via `withTenant`):**
- `POST /debtors` `{ name }` → cria `Debtor` + `DebtorAccess` (token novo de 32 bytes) → retorna `{ debtorId, accessLink }` **uma vez** (`accessLink = ${WEB_ORIGIN}/d/<token>`).
- `GET /debtors` → lista paginada (nome, `active`, `lastSeenAt`).
- `POST /debtors/:id/revoke` · `/reactivate` → liga/desliga `active`.
- `POST /debtors/:id/rotate-link` → novo token/link (invalida o anterior), retornado uma vez.
- `GET /debtors/:id/logins` → auditoria.

**Devedor (sem Supabase, sem senha):**
- `POST /auth/debtor/exchange` `{ token }` → `sha256(token)` → acha `DebtorAccess` ativo → emite **JWT próprio** (`APP_JWT_SECRET`; `sub=debtorId`, `role=DEBTOR`, `tenantId`, `debtorId`); atualiza `lastSeenAt`, grava `DebtorLoginEvent(success)`. Inválido/revogado → erro **genérico**. **Rate-limited**.
- O app guarda o JWT; reusa enquanto válido e re-troca pelo token do link quando expira.

**Removido:** `POST /auth/redeem` (org_code self-service). `Tenant.orgCode` permanece como id da carteira.

## Auth / guards

- `JwtGuard` verifica **dois tipos de token**: tenta `SUPABASE_JWT_SECRET` (super-admin/credor); senão `APP_JWT_SECRET` (devedor).
- `AuthUser` → `{ subjectId, role, tenantId, email?, debtorId? }` (hoje `{ supabaseId, email, role, tenantId }`); `subjectId` = supabaseId (credor) ou debtorId (devedor).
- `DebtorTokenService` assina/valida o JWT do devedor.

## Segurança (tradeoff do link + mitigações)

- Link = credencial portadora. **Token 32 bytes** (alta entropia), **guardado com hash** (sha256) — vazamento do banco não dá links usáveis; o claro só aparece uma vez.
- **Raio de dano mínimo:** devedor só vê a própria dívida — link vazado expõe **uma pessoa**, nunca a carteira.
- **Revogação/rotação por devedor** + **rate limit** no exchange + **erros genéricos** (anti-enumeração) + **auditoria** de acessos.
- `crypto.randomBytes` + sha256 (sem senha/bcrypt). Endurecimento futuro opcional: sessão presa ao dispositivo / link de 1 uso + re-auth curta.

## Web

- Rota `/d/[token]`: troca o token por JWT do devedor, guarda a sessão e mostra a dívida do devedor.

## Decisões assumidas (ajustáveis)

1. **Link persistente, revogável/rotacionável** (sem senha) — máxima praticidade.
2. **Token guardado com hash**; claro só no link, uma vez.
3. **Remover** o resgate por `org_code`.
4. Branch própria `feat/debtor-magic-link` a partir de `feat/fase-1`.

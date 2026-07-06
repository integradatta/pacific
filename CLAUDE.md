# CLAUDE.md — mapa do projeto Pacific

Guia de orientação para desenvolvimento assistido (Claude Code) e manutenção. Objetivo: entender a
arquitetura, localizar qualquer recurso e alterar com segurança **sem perder contexto**.

> Docs vivas complementares em `docs/`: `SPECIFICATION.md` (produto), `SCALABILITY.md` (escala),
> `RLS_RUNBOOK.md` (segurança de dados), `DEPLOY_RUNBOOK.md` (deploy), `DR_RUNBOOK.md` +
> `RECOVERY.md` (recuperação), `BACKUP.md` (backup sem Supabase Pro), `LOCATION_DESIGN.md` (GPS/geofence).

## O que é
Pacific é uma plataforma **white-label de acompanhamento financeiro familiar**. Um "padrinho" (credor)
acompanha "sobrinhos" (devedores) com operações (empréstimos), metas, localização consentida e
inteligência de carteira. O app do sobrinho vai à App Store como acompanhamento de metas/família —
**sem menção a dívida/cobrança** (ver [[white-label]] em `docs/SPECIFICATION.md`).

## Monorepo (npm workspaces + turbo)
```
packages/
  shared/    @pacific/shared — TS puro consumido DIRETO do src (main = ./src/index.ts).
             Finanças (finance/), risco, inteligência de carteira (intelligence/),
             comportamento (behavior/), utils (tags, datas, org-code), tipos, geo.
             ⚠️ Regras de negócio compartilhadas API↔web moram AQUI (fonte única).
  database/  @pacific/database — schema.prisma + migrations/ (aplicadas MANUALMENTE no Supabase,
             nunca no boot) + src/rls.sql (RLS FORCE por tenant). Ver RLS_RUNBOOK.
  api/       @pacific/api — NestJS. Backend REST. Toda a lógica de servidor.
apps/
  web/       @pacific/web — Next.js (app router). Portal do padrinho + admin + app do sobrinho (/d, /me).
  mobile/    @pacific/mobile — casca Capacitor que carrega o web (server.url) + background-geolocation.
```

## Backend (packages/api/src) — por domínio
| Módulo | Rota base | Responsabilidade |
|---|---|---|
| `auth/` | `auth`, `debtor` | Guards (jwt/roles/principal/debtor), magic-link do devedor (HS256), rate-limit do redeem |
| `creditors/` | `debtors` | Provisionamento de devedores pelo credor |
| `debts/` | `debts` | Operações (empréstimos), etiquetas, pagamentos, soft-delete |
| `dashboard/` | `dashboard` | Home agregada, carteira, KPIs, inteligência |
| `insights/` | `insights` | DebtorScore, radar de esfriamento, promessas |
| `location/` | `location`, `debtor/me/location` | Consentimento, pings, geofences, histórico |
| `notifications/` | `notifications` | Notificações in-app + Web Push (VAPID) + schedulers |
| `reports/` | `reports` | Relatório mensal / executivo |
| `admin/` | `admin` | Super-admin: aprova credores, audita, gerencia contas |
| `tracking/` | — | Trilha de eventos da plataforma (auditoria) |
| `common/` | `health`, `public/events` | Prisma, Redis, filtro de exceções, log-sanitize, RLS healthcheck, Sentry, schedulers de retenção |

**Segurança-chave** (ver auditoria em `docs/`): RLS FORCE por tenant (`src/rls.sql` + `RLS_STRICT`
fail-closed no boot via `common/rls-healthcheck.service.ts`); throttler global por IP com storage Redis
(`app.module.ts`); helmet + CORS com `WEB_ORIGIN` obrigatório + `ValidationPipe` estrito + limite de
body (`main.ts`); tokens de magic-link **hasheados** (`auth/access-token.util.ts`); logs redigidos
(`common/log-sanitize.ts`). **Sem SQL raw** (Prisma parametriza) e **sem upload de arquivos**.

## Frontend (apps/web/app) — por papel
- **Padrinho:** `/dashboard`, `/carteira`, `/operacoes/*`, `/devedores`, `/vencimentos`, `/recebiveis`,
  `/relatorios`, `/evolucao`, `/localizacao`, `/notificacoes`, `/configuracoes`. Shell: `components/Shell.tsx`.
- **Admin/Owner:** `/admin/*` (aprovações, auditoria, sessões, segurança, monitoramento…). Shell: `components/admin/AdminShell.tsx`.
- **Sobrinho (white-label):** `/d`, `/d/[token]` (entrada por link), `/me` (cofre/metas). ⚠️ Nada de
  marca "Pacific" nem termos de dívida aqui — é o app da App Store.
- Chamadas à API: `apps/web/lib/api.ts` (`NEXT_PUBLIC_API_URL`). Risco/etiquetas: `@pacific/shared` (`effectiveRisk`).

## Convenções (ao editar, siga o código ao redor)
- **Dinheiro** sempre em `Decimal` (decimal.js) — nunca `number`. Ver `packages/shared/src/finance`.
- **Status da dívida é DERIVADO** (`deriveStatus`), nunca persistido. Não recrie coluna `status`.
- **Testes colocados** (`*.test.ts` ao lado do código, Vitest). 40+ arquivos. Rode o teste do arquivo tocado.
- Comentários em **português**, densidade e tom do arquivo vizinho.
- `@pacific/shared` é a **fonte única** de regra de negócio — mudou lá, reflete em API e web.
- Migrações são **aditivas/idempotentes** e aplicadas **manualmente** antes do deploy (ver DEPLOY_RUNBOOK).

## Comandos
```bash
npm ci                      # instalar (raiz; workspaces)
npm run db:generate         # Prisma Client (necessário p/ build/test)
npm run lint                # turbo → tsc/eslint por workspace
npm run test                # turbo → vitest por workspace
npm run build               # turbo → build por workspace
# API local: npm run dev --prefix packages/api    (porta 3333)
# Web local: npm run dev --prefix apps/web         (porta 3000)
# Banco (com DIRECT_URL): npm run db:release       (migrate deploy + rls)
```

## Como localizar coisas rapidamente
- **Uma funcionalidade** → comece pelo módulo da API (tabela acima) e a rota web equivalente.
- **Uma regra financeira/risco** → `packages/shared/src/finance` / `intelligence`.
- **Uma env var** → `.env.example` (lista comentada e completa).
- **Fluxo de deploy / recuperação** → `docs/DEPLOY_RUNBOOK.md`, `docs/RECOVERY.md`.
- **Histórico/decisões** → `git log`, PRs no GitHub (`integradatta/pacific`), `docs/HANDOFF.md`.

# DEPLOY RUNBOOK — merge + deploy de tudo que está em branch

> **Objetivo:** subir para produção o trabalho acumulado (não mergeado) e testar. Repo é **público**
> — **nenhum segredo aqui** (chaves/senhas ficam nos seus arquivos locais, citados por nome).
>
> **⚠️ Regra de ouro do projeto:** o Dockerfile **NÃO roda migração no boot** (`DIRECT_URL` omitido de
> propósito). Toda migração é aplicada **manualmente no Supabase ANTES** de subir o código novo. Se uma
> tabela/coluna/enum novos não existirem quando o código subir, transações falham — e, pior, com
> `RLS_STRICT` (ver §4) o **boot aborta**.

---

## 1. Branches a mergear (nesta ordem)

1. **`feat/super-admin`** — o produto inteiro (76 commits à frente da `main`): super-admin, localização,
   inteligência, Web Push, promessas, hardening de segurança, leveza, escala.
2. **`feat/mobile-distribution`** — 1 commit no topo (`8e358a6`): preparação do app nativo
   (TestFlight/APK). Depende do location-manager que está em `feat/super-admin`, então **mergeie depois**.

Sugestão: PR `feat/super-admin` → `main`; depois PR `feat/mobile-distribution` → `main` (ou mergeie a
mobile dentro da super-admin antes do PR único). Nada foi mergeado na main ainda.

---

## 2. O que a última rodada adicionou (commits mais recentes, top da feat/super-admin)

| Commit | O quê | Exige no deploy |
|---|---|---|
| `dfd5fa7` feat(insights) | DebtorScore 0–100 por pessoa | — (usa dados já existentes) |
| `871840b` feat(push) | Web Push (VAPID): resumo diário 8h BRT + push de eventos | **mig 24** + **env VAPID** (§3, §5) |
| `7e5be0f` feat(promises) | Promessas rastreadas (PaymentPromise) → alimenta o score | **mig 25** + **rls.sql** (§3, §4) |
| `f413dde` fix(security) | notif ignora quitada; deleteTenant apaga toda PII (LGPD); sessão de devedor revoga; PrincipalGuard sempre checa; validação financeira; magic link no fragment; **RLS_STRICT default-on**; CI | **RLS_STRICT/rls.sql** (§4) |
| `9ce410e` perf(leveza) | /dashboard/home agregado; snapshot no cron; dedup cliente/haversine; **remove Debt.status + Debtor.lastLocation** | **mig 26** (§3) |
| `97f2c65` perf(scale) | notificações set-based; advisory lock no digest; FOR UPDATE no pagamento; cache de geofences; expurgo de rate-limit | — (só código) |
| `202ec52` feat(app) | **white-label cofre/família** no app do sobrinho + GPS de produção (5min/bateria/Capacitor) | — (só web) |
| `f125b5d` docs(mobile) | purpose strings de localização p/ App Store | — (docs) |
| `8e358a6` feat(mobile) | prep de distribuição (branch mobile) | ver §7 |

Racional detalhado de cada item nas mensagens de commit e em `docs/SPECIFICATION.md`.

---

## 3. Migrações do banco (aplicar no Supabase, em ordem, ANTES do deploy)

As **novas**: **24, 25, 26** (rodada do produto) e **27** (loop de promessas). As 20–23 são de rodadas
anteriores (a **20 já foi aplicada**; **confirme 21, 22, 23** no Supabase — se faltarem, aplique antes).
Se você já subiu 24–26 em produção, **falta só aplicar a 27** antes do próximo deploy da API.

| # | Arquivo | O quê | Observação |
|---|---|---|---|
| 21 | `21_weekly_digest_pref` | coluna `User.weeklyDigestOptIn` | confirmar se aplicada |
| 22 | `22_weekly_digest_type` | enum `NotificationType.WEEKLY_DIGEST` | confirmar |
| 23 | `23_debtor_signals` | tabela `DebtorSignal` (RLS FORCE) + enums de notif | confirmar |
| 24 | `24_push_subscription` | tabela `PushSubscription` (global, RLS + `app_full_access`) | **nova** — Web Push |
| 25 | `25_payment_promises` | enum `PromiseStatus` + tabela `PaymentPromise` (RLS FORCE) | **nova** — entra no healthcheck de RLS (§4) |
| 26 | `26_drop_dead_columns` | **DROP** `Debt.status`, `Debtor.lastLocation`, enum `DebtStatus` | **nova, destrutiva** (dados eram inúteis: status sempre GREEN, lastLocation sempre null) |
| 27 | `27_promise_events` | 3 valores no enum `PlatformEventType` (`PROMISE_MADE/KEPT/BROKEN`) — eventos de promessa na timeline | **nova**, aditiva/idempotente. **Aplicar ANTES do deploy**: o histórico da operação consulta esses valores |
| 28 | `28_forecast_month` | tabela `ForecastMonth` (previsto×realizado, P7) com RLS FORCE + policy | **nova**, aditiva. Já inclui a RLS; `db:rls` também traz a policy (idempotente) |

**Como aplicar:** cole o conteúdo de cada `packages/database/migrations/NN_*/migration.sql` no SQL Editor
do Supabase, em ordem. Ou, se você mantém o `_prisma_migrations` em dia, use `npm run db:release`
(= `prisma migrate deploy` + `db:rls`) com a `DIRECT_URL` (conexão dona).

---

## 4. RLS — `rls.sql` + `RLS_STRICT` (⚠️ pode abortar o boot)

- Rode **`npm run db:rls`** (aplica `packages/database/src/rls.sql` com a `DIRECT_URL`/conexão dona).
  Ele liga FORCE RLS + policies, **incluindo a nova `PaymentPromise`** e o `app_full_access` de
  `PushSubscription`. `db:rls` é idempotente.
- **`RLS_STRICT` agora é padrão-ON em produção (fail-closed).** O healthcheck de boot exige FORCE RLS em
  todas as tabelas de `FORCED_TABLES` (que agora inclui `PaymentPromise`) e a role de runtime sem
  BYPASSRLS. **Se a mig 25 + rls.sql não estiverem aplicadas quando o código subir, a API não sobe.**
- Ordem segura: **mig 24/25/26 → `db:rls` → deploy do código**.
- Escape de emergência (só se travar): `RLS_STRICT=off` no ambiente da API. Corrija e volte a ligar.
- Detalhes: `docs/RLS_RUNBOOK.md`.

---

## 5. Variáveis de ambiente (setar ANTES/junto do deploy)

**Web Push (sem elas o push é no-op — não quebra nada, só não envia):**
- **Railway (API):** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:raylanborgescont@gmail.com`
- **Vercel (web):** `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (= a chave pública)

> 🔑 Os **valores** das chaves VAPID (inclusive a privada) estão no seu handoff local:
> `~/.claude/.../memory/pacific-deploy-pendente.md`. **Não** os coloque no repo (é público).

**Já existentes (confirmar que seguem setadas):** `DATABASE_URL` (pooler 6543, role `pacific_app`),
`SUPABASE_*`, `REDIS_URL` (throttler), `SENTRY_*`, `WEB_ORIGIN`, `APP_JWT_SECRET`.

---

## 6. Sequência de deploy + verificação

1. Backup do banco (ver `docs/DR_RUNBOOK.md`).
2. Aplicar migrações **21?→24→25→26** no Supabase (§3).
3. `npm run db:rls` (§4).
4. Setar envs VAPID (§5).
5. Deploy **API (Railway)** → conferir nos logs: `RLS verificada: isolamento por tenant ativo (FORCE)…`
   e `GET /health/ready` = 200. Se o boot abortar por RLS, algo do §3/§4 faltou.
6. Deploy **web (Vercel)**.
7. Verificação rápida (produção):
   - Login padrinho → dashboard abre (agora via `/dashboard/home`, uma chamada).
   - Criar promessa numa operação aberta → aparece; score reflete.
   - Configurações → "Ativar notificações no navegador" aparece (se VAPID setado no Vercel).
   - App do sobrinho (abrir convite `/d#<token>`) → "Meu cofre" (sem menção a dívida/padrinho);
     Localização → compartilhar (5 min).
   - Admin: excluir um tenant de teste → confirmar que localização/push/stats somem (LGPD).
8. CI: o GitHub Actions (`.github/workflows/ci.yml`) roda lint+test+build em cada push/PR.

**Rollback:** a mig 26 é destrutiva (DROP de colunas). Se precisar reverter o código, ele já não usa
essas colunas — não há rollback de dados a fazer. Para o resto, reverter o deploy da API/web e manter
o banco migrado é seguro (as migrações são aditivas, exceto a 26).

---

## 7. App nativo (mobile) — separado, não bloqueia o deploy web

Branch `feat/mobile-distribution`. O build final roda **no seu Mac** (precisa de Java/Android SDK/Xcode,
ausentes no ambiente de preparação). Tudo documentado em:
- `apps/mobile/DEPLOY_MOBILE.md` — passo a passo Android (APK) + iOS (TestFlight).
- `apps/mobile/DECISIONS.md` — decisões tomadas + alternativas descartadas.
- **`apps/mobile/QUANDO_EU_VOLTAR.md`** — local/gitignored, com a **senha da keystore** + comandos em
  ordem. **Não versionar** (repo público).
- `apps/mobile/keystore.properties` — local/gitignored (senha forte já gerada).

Resumo do que falta e depende de você: criar a keystore (`keytool`), `cap add ios/android`, aplicar os
snippets de `native-templates/`, `gradlew assembleRelease` (APK), e Archive+upload iOS (Apple ID + 2FA).

---

## 8. Ponteiros
- Memória local (persistente entre sessões): `pacific-deploy-pendente`, `pacific-gps-whitelabel`.
- Especificação: `docs/SPECIFICATION.md`. Escala: `docs/SCALABILITY.md`. RLS: `docs/RLS_RUNBOOK.md`.

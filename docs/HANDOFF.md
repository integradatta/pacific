# Pacific — HANDOFF (2026-06-18)

> Onde paramos e como continuar. Tudo abaixo está **na `main`** (mergeado e no GitHub).

## Atualização 2026-06-21 — DEPLOY no ar + Sprint de produto
- **Repositório agora:** `github.com/integradatta/pacific` (movido de h2h988pn28-svg). `origin` já aponta pra lá.
- **DEPLOY funcionando (ponta a ponta):**
  - **Web:** Vercel, projeto `pacific-web` → `https://pacific-web-chi.vercel.app` (Root Directory `apps/web`). `next.config` tem `extensionAlias` (.js→.ts) p/ resolver imports NodeNext do `@pacific/shared` no webpack.
  - **API:** Railway, serviço `pacific-api` → `https://pacific-api-production.up.railway.app`. Build pelo **Dockerfile** da raiz (monorepo). `railway.json`/`render.yaml` versionados.
  - **Variáveis no Railway:** `DATABASE_URL` (6543 pgbouncer), `SUPABASE_JWT_SECRET`, `APP_JWT_SECRET`, `WEB_ORIGIN`, `REDEEM_*`. **`DIRECT_URL` foi REMOVIDA de propósito** → o `CMD` do container **pula o migrate** no boot (fail-closed quando DIRECT_URL existe). **Migrações são aplicadas manualmente** com `cd packages/database && npx prisma migrate deploy` (usa o `.env` local com pooler de sessão 5432). Já apliquei `1_alert_milestones` e `2_debtor_location` em prod.
  - **Vercel env:** `NEXT_PUBLIC_API_URL=https://pacific-api-production.up.railway.app` (+ SUPABASE url/anon).
- **Correções de deploy que entraram:** scanner do Railway exigia `next ≥ 14.2.35` (CVEs) — atualizado; `--include=dev` no `npm ci`; **JwtGuard verifica JWT do Supabase por JWKS (ES256)** — o projeto usa signing keys assimétricas, não HS256 (era o 401 do `register-creditor`); Supabase **"Enable email provider" ligado** (signups estavam off).
- **Sprint de produto entregue (commits na main):** **#1** login/acesso pós-auth (register-creditor idempotente, `GET /auth/me`, recuperação de conta órfã) · **#2** cadastro simplificado `/operacoes/nova` + cálculo em tempo real (`operationPreview`) + `POST /debts/quick` · **#3** score de risco (`riskLevel` LOW/MEDIUM/HIGH; `RiskBadge`) · **#7** dashboard ampliado (retorno esperado, ativas/vencidas, distribuição por risco) · **#4** alertas automáticos réguas 15/7/3/0/atraso + painel (localStorage) · **#8 (parcial)** busca+filtros na Carteira + badge de notificações · **#3-GPS** preparação inerte (`Debtor.lastLocation` + `LocationPanel` "Em desenvolvimento", **sem rastreamento real**) · **regra de negócio:** juros **mínimo de 1 mês** para taxa mensal (`balanceAt`).
- **🟦 PRÓXIMA TAREFA: etapa #6 — Aparência premium** (Stripe/Linear/Mercury) + **dark mode** + skeleton loading. O usuário pediu para usar a **skill `frontend-design`** (reativada em `~/.claude/settings.json`; carrega após reiniciar o Claude Code). Itens opcionais restantes do #8: **tags** e **histórico da operação**.
- 🔴 Pendente (segurança): **rotacionar** senha do banco + `SUPABASE_JWT_SECRET` (apareceram no chat) e atualizar no Railway.

## Atualização 2026-06-19
- ✅ **Portal do credor COMPLETO** (PR #5): telas Carteira, Vencimentos, Notificações adicionadas — nav sem 404.
- ✅ **Supabase DB configurado:** conectado via **pooler** `aws-1-sa-east-1.pooler.supabase.com` (SP); `0_init` aplicada (todas as tabelas); RLS aplicada (forced em Debtor/Debt/Notification/DebtorLoginEvent). `packages/api/.env` e `packages/database/.env` com pooler (sessão/5432 p/ migração; transação/6543 + pgbouncer=true p/ API). Senha correta do banco: `*27Raylan7212`.
  - **Nota Supabase:** liga RLS em toda tabela `public` por padrão → `Tenant` e `DebtorAccess` ficaram com RLS on **sem policy** (forced=false). A app conecta como o **dono** (`postgres`), que acessa tabelas não-forced normalmente (ok). Se um dia usar role não-dono, criar policies nelas.
  - 🔴 **Rotacionar** a senha do banco / JWT secret / sb_secret (colados no chat).
- **Falta para rodar de ponta a ponta:** (1) ✅ **cadastro de credor FEITO** (PR #6: `/register` no web + `PrincipalGuard` que resolve role+tenant do credor pelo NOSSO banco por request, já que o JWT do Supabase não carrega tenant); (2) **rodar web+api localmente OU deploy** (Vercel web + host p/ api) — próximo passo natural; (3) confirmar que o JWT do credor é HS256 no primeiro login real. Para signup instantâneo, **desativar "Confirm email"** no Supabase (Authentication → Providers → Email); com confirmação ligada, `/register` mostra mensagem para confirmar e entrar.
- A seção "PRÓXIMA TAREFA" abaixo (completar portal) já está **CONCLUÍDA**; próximo provável: signup do credor + deploy, ou alertas em tempo real, ou app mobile.

## O que é
SaaS multi-tenant **acadêmico/fictício** de monitoramento/gestão de empréstimos privados (não é cobrança). Monorepo Turborepo. Repo **privado** `github.com/h2h988pn28-svg/pacific` (gh já autenticado nesta máquina).

## Estado atual (tudo na `main`, `ac5ef5e`)
- **Nenhum PR aberto, nenhuma branch de feature** (PRs #1–#4 mergeados e branches removidas). Árvore limpa.
- **Verde:** `npm run lint` (4/4) · `npm test` (shared + api) · `npm run build -w @pacific/web`.
- **Validado contra Postgres real (embedded-postgres):** RLS **6/6** e link mágico **7/7**.

### Já construído
- **Auth 3 papéis:** super-admin/credor via **Supabase JWT**; **devedor via link mágico** (JWT próprio, `APP_JWT_SECRET`). `JwtGuard` aceita os dois (tenta Supabase, depois APP).
- **Multi-tenancy + RLS real:** `tenantId` em tudo; `TenantScopedService.withTenant` faz `set_config('app.current_tenant')` por transação; `rls.sql` com ENABLE+FORCE+policies (Debtor/Debt/Notification/DebtorLoginEvent). `DebtorAccess` fica **fora** da RLS (lookup pré-auth do link). FK composta de paridade de tenant em Debt.
- **Dívidas:** CRUD tenant-scoped, paginado. **Motor financeiro** Decimal.js (saldo, juros compostos, status/semáforo, projeções) + **scores** (recuperabilidade/temperatura 0–100).
- **Dashboard:** `/dashboard/kpis` e `/dashboard/portfolio`. **Notificações:** gerar (vencimento/atraso, idempotente), listar, marcar lida.
- **Login do devedor por link:** credor provisiona (`POST /debtors`) → recebe link único → devedor abre `/d/[token]` → sessão → vê a própria dívida em `/me`. Revogar/reativar, rotacionar link, auditoria de acessos.
- **Web "Torre de Controle" (Next 14):** `/login`, `/dashboard` (Horizonte de Vencimentos + KPIs + Carteira com scores), `/devedores` (gerenciar devedores + copiar link), `/d/[token]`, `/me`.
- **Localização:** NÃO implementada — só pontos de extensão inertes (`@pacific/shared/location` + `LocationModule.register`). Decisão ética firme: se for feita, **simulada** (sem rastreamento real de pessoas).

### Endpoints (NestJS, `packages/api`)
`POST /auth/register-creditor` · `POST /auth/debtor/exchange` · `POST/GET /debts` `GET /debts/:id` `GET /debts/:id/summary` · `GET /dashboard/kpis|portfolio` · `GET/POST /notifications` `PATCH /notifications/:id/read` · `POST/GET /debtors` `:id/revoke|reactivate|rotate-link` `GET /debtors/:id/logins` · `GET /debtor/me/debts`.

## >>> PRÓXIMA TAREFA (combinada): completar o portal do credor
Os itens do menu **Carteira** (`/carteira`), **Vencimentos** (`/vencimentos`) e **Notificações** (`/notificacoes`) são **links sem página (404)**. As APIs já existem:
- Carteira: `GET /debts` (+ `/dashboard/portfolio`).
- Vencimentos: derivar de `/dashboard/portfolio` (dias restantes/status) — "radar de vencimentos".
- Notificações: `GET /notifications` (+ `POST /notifications/generate`, `PATCH /:id/read`).
Construir as 3 telas (Next 14, estética Torre de Controle), com PR + review + merge (padrão: nada sem revisar; build/lint verdes). Nav em `apps/web/components/Shell.tsx`.

## Supabase (config pendente — fazer DEPOIS)
- Arquivos de env **criados e gitignored** (não vão pro git): `apps/web/.env.local` (URL + publishable), `packages/api/.env` (SUPABASE_URL, SUPABASE_JWT_SECRET, SUPABASE_SERVICE_ROLE_KEY, **APP_JWT_SECRET gerado**, DATABASE_URL, etc.), `packages/database/.env` (DATABASE_URL). Já preenchidos com os valores que o usuário passou.
- 🔴 **ROTACIONAR** (foram colados no chat → no histórico): senha do banco, `SUPABASE_JWT_SECRET`, `sb_secret`. Em Supabase → Settings → Database / API.
- **Conectividade:** o host direto `db.<ref>.supabase.co:5432` **não resolve** (Supabase descontinuou IPv4 direto) → usar a **URI do "Connection pooling"** (`...pooler.supabase.com`). Além disso, o ambiente do agente provavelmente só libera HTTPS — então **aplicar migração/seed/rodar a API deve ser na máquina do usuário ou via deploy (Vercel)**, não pelo sandbox.
- Quando for conectar: trocar `DATABASE_URL` pela URI do pooler em `packages/api/.env` e `packages/database/.env`; rodar `npm run db:deploy -w @pacific/database`; aplicar `packages/database/src/rls.sql` (DEPOIS do seed); `npm run db:seed`. Conferir como o JWT do credor é assinado no projeto (HS256 com JWT secret vs. signing keys assimétricas) — pode exigir ajuste no `JwtGuard`.

## Comandos
`npm install` · `npm test` · `npm run lint` · `npm run build -w @pacific/web`
Validação e2e (Postgres efêmero): `npm i --no-save embedded-postgres --cache /tmp/npm-cache-pac` e então `npx tsx packages/database/rls-e2e.ts` (6/6) / `npx tsx packages/database/magic-link-e2e.ts` (7/7).

## Specs/relatórios
`docs/superpowers/specs/` (design, magic-link) · `docs/superpowers/reports/` (validações RLS e link) · `docs/superpowers/plans/`.

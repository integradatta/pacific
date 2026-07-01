# Pacific — Especificação Completa do Projeto

> Documento único e auto-contido descrevendo TODO o sistema Pacific (arquitetura, modelo de dados,
> papéis, funcionalidades, API, segurança, deploy e estado atual). Serve para análise por
> ferramentas externas. Gerado a partir do código real (monorepo). Repositório:
> `github.com/integradatta/pacific` (privado).

## 1. Visão geral

**Pacific** é um SaaS multi-tenant de **monitoramento de crédito privado / empréstimos entre pessoas
próximas**. Um credor ("padrinho") registra ajudas financeiras (empréstimos) concedidas a devedores
("sobrinhos"), acompanha valores/vencimentos/situação, recebe notificações e — de forma consentida —
a localização do devedor. O devedor acessa um app leve (PWA) por link mágico (sem senha), vê o
combinado como uma "viagem" e pode avisar pagamentos. Um super-admin governa a plataforma
(aprovações, auditoria, segurança).

Posicionamento do app do devedor: **rede de confiança entre pessoas próximas** (tom Life360 / Family
Link), NÃO ferramenta de cobrança/vigilância.

## 2. Terminologia (só na UI; identificadores no código permanecem em inglês)

| Domínio (UI PT) | Código/negócio |
|---|---|
| Padrinho | Credor / CREDITOR / Tenant |
| Sobrinho | Devedor / DEBTOR / Debtor |
| Ajuda | Empréstimo / Debt |
| Gratidão | Juros / rate (interest) |
| Viagem | Metáfora de UI do sobrinho para o combinado (a dívida) |

## 3. Papéis e autenticação

Papéis (`UserRole`): **OWNER ⊇ SUPER_ADMIN > CREDITOR > DEBTOR**.
- **OWNER**: admin máximo (superconjunto do SUPER_ADMIN). tenantId nulo.
- **SUPER_ADMIN**: administra a plataforma (aprova credores, audita, segurança). tenantId nulo.
- **CREDITOR** (padrinho): opera sua carteira. Vinculado a um Tenant (aprovado+ativo p/ operar).
- **DEBTOR** (sobrinho): acessa só o próprio app.

Autenticação (dois mecanismos):
- **Credor/Admin**: **Supabase Auth** (JWT ES256 via JWKS). O papel/tenant são a **fonte da verdade no
  NOSSO banco** (tabela `User` por `supabaseId`), resolvidos pelo `PrincipalGuard` a cada request —
  não confiam no JWT. `/auth/me` retorna papel, tenant, aprovação, aceite de termos e preferência de
  resumo semanal. Roteamento pós-login por papel (`pathForMe`): OWNER/SUPER_ADMIN→/admin; credor sem
  tenant→/register; não aprovado→/pendente; sem aceite de termos→/termos; senão→/dashboard.
- **Devedor**: **link mágico** (token) trocado por um **APP_JWT (HS256)** próprio, guardado em
  `localStorage` (`pacific_debtor_jwt`). Sem senha. `DebtorGuard` rejeita sessão órfã (debtor
  removido) com 401 ("convite expirado").

Guards: `JwtGuard` (verifica JWT), `PrincipalGuard` (resolve credor/admin por supabaseId),
`TenantGuard` (resolve tenantId + gate de aprovação do credor), `DebtorGuard` (devedor existe?),
`RolesGuard` (@Roles), `IpRateLimitGuard`, `ThrottlerGuard` (global, Redis se `REDIS_URL`).
Force-logout: `User.revokedAfter` invalida tokens emitidos antes.

## 4. Arquitetura / stack

Monorepo **Turborepo** (npm workspaces):
- `packages/database` — Prisma 5 + PostgreSQL (Supabase). Schema, migrações (aplicadas manualmente em
  prod), `src/rls.sql` (policies), `scripts/` (role, backup).
- `packages/shared` — tipos + motor financeiro + inteligência + utils (isomórfico).
- `packages/api` — **NestJS 10** (API REST). Deploy no **Railway** (Dockerfile).
- `apps/web` — **Next.js 14** (App Router) + Tailwind + React Query. Deploy na **Vercel**. PWA.
- `apps/mobile` — Capacitor (scaffold; app nativo é futuro).

Fluxo de deploy: código na branch `main` → Railway (API) + Vercel (web) deployam. **Migrações e
policies RLS são aplicadas MANUALMENTE** no Supabase (o container pula `migrate deploy` porque
`DIRECT_URL` é omitido de propósito; runtime usa só `DATABASE_URL`).

## 5. Multi-tenancy e segurança

- **Isolamento por tenant**: `TenantScopedService.withTenant(tenantId, fn)` roda dentro de uma
  transação que executa `set_config('app.current_tenant', tenantId, true)`; as policies **RLS**
  (`FORCE ROW LEVEL SECURITY`) filtram por esse valor. Aplica-se às 11 tabelas tenant-scoped: Debtor,
  Debt, Notification, DebtorLoginEvent, PaymentClaim, LocationConsent, DebtorPosition, LocationPing,
  Geofence, GeofenceEvent, MonthlyReport.
- **Role da API sem BYPASSRLS**: em produção a API conecta como `pacific_app` (não dona das tabelas,
  sem bypass) via pooler de transação. `RLS_STRICT=on` faz o `RlsHealthCheck` **abortar o boot** se
  detectar bypass ou FORCE ausente (fail-closed).
- **Tabelas globais** (User, Tenant, AdminAuditLog, PlatformEvent, TenantStats, PortfolioSnapshot,
  DeviceToken, DebtorAccess): RLS deny-by-default (mig 14, bloqueia anon/PostgREST) + policy
  `app_full_access` liberando só a `pacific_app` (controle de acesso feito na camada de aplicação).
- **Anti-scraping**: throttler global (300/min/IP, Redis-backed opcional), `trust proxy` p/ IP real.
- **Observabilidade**: Sentry (no-op sem DSN) — `@sentry/node` (API, captura 5xx) e `@sentry/browser`
  (web, ErrorBoundary).
- **Headers**: helmet (API) + CSP/HSTS/X-Frame-Options (web via next.config). CORS fail-fast (WEB_ORIGIN
  obrigatório em prod). Body limit 100kb.
- **Motor de risco proprietário**: roda no servidor (não vaza pro cliente).

## 6. Modelo de dados (Prisma)

Enums: `UserRole`(OWNER/SUPER_ADMIN/CREDITOR/DEBTOR) · `TenantStatus`(ACTIVE/SUSPENDED) ·
`TenantApproval`(PENDING/APPROVED/REJECTED) · `DebtStatus`(GREEN/YELLOW/ORANGE/RED) ·
`RatePeriod`(MONTHLY/ANNUAL) · `LocationConsentState`(NEVER/DECLINED/GRANTED/REVOKED) ·
`PaymentClaimStatus`(PENDING/CONFIRMED/REJECTED) ·
`PlatformEventType`(LOGIN, LOGOUT, LOGIN_FAILED, LINK_USED, LINK_CREATED, LINK_ROTATED,
ACCESS_REVOKED, ACCESS_REACTIVATED, OPERATION_CREATED, OPERATION_UPDATED, OPERATION_PAID,
PAYMENT_CLAIMED, LOCATION_CONSENT, CLIENT_CREATED, TENANT_APPROVED, TENANT_SUSPENDED, ERROR, IMPORTANT) ·
`NotificationType`(DUE_SOON, DUE_15, DUE_7, DUE_3, DUE_1, DUE_TODAY, OVERDUE, LOCATION_DECLINED,
LOCATION_STOPPED, LOCATION_SILENT, PAYMENT_CLAIMED, DEBT_SETTLED, DEBTOR_FIRST_ACCESS, WEEKLY_DIGEST).

Modelos (campos principais):
- **Tenant**: id, name, orgCode(único), approval, status, createdAt. A "carteira" de um padrinho.
- **User**: id, supabaseId(único), email(único), role, tenantId?, revokedAfter?, termsAcceptedAt?,
  termsVersion?, **weeklyDigestOptIn?**(null=não decidiu), createdAt. Credor/admin (Supabase).
- **Debtor** (sobrinho): id, tenantId, userId?(único), name, createdAt. FK→Tenant, →User.
- **Debt** (ajuda): id, tenantId, debtorId, description?, tags[], principal(Decimal), rate(Decimal),
  ratePeriod, currency, startDate, dueDate, paidAmount(Decimal), settledAt?, deletedAt?(soft-delete),
  createdAt. FK→Debtor. RLS FORCE.
- **PaymentClaim**: id, tenantId, debtId, debtorId, amount, note?, status(PaymentClaimStatus),
  resolvedAt?, createdAt. Pagamento AVISADO pelo sobrinho (o padrinho confirma). RLS FORCE.
- **Notification**: id, tenantId, debtorId?, debtId?, type(NotificationType), title, body, readAt?,
  createdAt. Único por (debtId,type). In-app; o credor vê em /notificacoes. RLS FORCE.
- **DeviceToken**: token de push do dispositivo do sobrinho (FCM externo; sem envio implementado).
- **DebtorAccess**: tokenHash, debtorId, tenantId, active, lastSeenAt?. Link mágico (fora do RLS
  tenant — lookup por token antes do contexto de tenant).
- **DebtorLoginEvent**: acesso do sobrinho (debtorId, tenantId, success, ip?, at). RLS FORCE.
- **LocationConsent**: debtorId(único), tenantId, state(LocationConsentState), consentText?,
  grantedAt?/declinedAt?/revokedAt?, updatedAt. RLS FORCE.
- **DebtorPosition**: debtorId(único), tenantId, lat, lng, accuracy?, battery?, recordedAt. Última
  posição ao vivo. RLS FORCE.
- **LocationPing**: histórico de posições (tenantId, debtorId, lat, lng, accuracy?, battery?,
  recordedAt). Retenção por job. RLS FORCE.
- **Geofence** / **GeofenceEvent**: cercas (label, lat, lng, radiusM) e entradas/saídas. RLS FORCE.
- **MonthlyReport**: relatório mensal materializado por tenant+mês. RLS FORCE.
- **TenantStats**: KPIs materializados por tenant (job diário) — escala do admin sem varrer dívidas.
- **PortfolioSnapshot**: snapshot semanal da carteira (tendência).
- **PlatformEvent**: feed global de eventos (auditoria/atividade do super-admin). Global.
- **AdminAuditLog**: ações administrativas. Global.

## 7. Motor financeiro (`packages/shared/finance`)

Calcula, a partir dos termos (principal, rate, ratePeriod, startDate, dueDate) e pagamentos:
- **balanceAt / accruedInterest**: saldo devido com "gratidão" (juros) acumulada até uma data.
- **amountDue**: saldo bruto − pago. **settled**: quitada.
- **daysRemaining**: dias até (ou após) o vencimento. **status/riskLevel** (bandas GREEN/YELLOW/
  ORANGE/RED).
- **recoverabilityScore** e **paymentProbability** (0–100): probabilidade de pagamento.
- `operationPreview` (prévia no servidor), `summarize` (resumo completo). `normalizeTags`.

Inteligência (`packages/shared/intelligence`): saúde da carteira, concentração, rankings, tendência,
padrões (`patterns`) — usados pelo dashboard.

## 8. Funcionalidades por módulo

### 8.1 Carteira / operações (credor) — `/debts`, `/carteira`, `/operacoes/*`
- Criar operação: completa (`POST /debts`) ou rápida (cria devedor+dívida+link: `POST /debts/quick`).
  **Data inicial opcional** → registrar dívidas ANTIGAS (passado). Prévia no servidor (`POST /debts/preview`).
- Editar: etiquetas (`PATCH /debts/:id/tags`), **datas** (`PATCH /debts/:id/dates` — corrige
  inicial/vencimento; recalcula gratidão). Pagamento (`POST /debts/:id/payments`, parcial/total).
  Renegociação (`POST /debts/:id/renegotiate`). Soft-delete/lixeira 30 dias (`DELETE`, `POST
  /debts/:id/restore`, `GET /debts/trash`). Detalhe/summary/histórico (`GET /debts/:id[/summary|/history]`).
- Confirmar/rejeitar pagamento avisado (`POST /debts/claims/:id/confirm|reject`, `GET /debts/claims/pending`).
- Exportação CSV (no front).

### 8.2 Dashboard / inteligência (credor) — `/dashboard`
- `GET /dashboard/kpis`, `/portfolio` (linhas com risco/probabilidade), `/intelligence` (saúde,
  concentração, padrões), `/copilot` (**IA-1 determinística**, sem LLM: cobrar hoje, top riscos,
  resumo). IA-2 (probabilidade de pagamento por operação), IA-3 (padrões automáticos).

### 8.3 Notificações (credor) — `/notifications`, `/notificacoes`
In-app (o credor vê a lista; sem push implementado). Tipos:
- **Vencimento** (réguas DUE_15/7/3/1/hoje/OVERDUE) — geradas por scheduler diário 8h ou manual.
- **Eventos do sobrinho**: LOCATION_DECLINED (recusou), LOCATION_STOPPED (parou), LOCATION_SILENT
  (sem sinal 48h — proxy de "sumiu"), PAYMENT_CLAIMED (avisou pagamento), DEBT_SETTLED (quitou),
  DEBTOR_FIRST_ACCESS (1º acesso).
- **WEEKLY_DIGEST**: resumo semanal (segunda 8h) só p/ quem optou (`weeklyDigestOptIn`); dedup 1/sem;
  gatilho manual `POST /notifications/weekly-digest`.

### 8.4 Relatórios mensais (credor) — `/reports`, `/relatorios`, `/relatorio`
`GET /reports`, `POST /reports/generate`. Scheduler dia 1 às 5h arquiva o mês anterior por tenant.

### 8.5 Localização consentida — painel do credor `/location`, `/localizacao`; app sobrinho `/local`
- Estados de consentimento: NEVER/DECLINED/GRANTED/REVOKED (opt-in **voluntário**, só o padrinho vê,
  desligável nas configurações). DECLINED/REVOKED notificam o padrinho.
- Sobrinho: `GET/POST /debtor/me/location/consent`, `POST /debtor/me/location/ping` (lote; motor
  singleton no front com outbox offline, throttle, resiliência). Recusa de permissão → REVOKED.
- Padrinho: `GET /location/positions` (mapa Leaflet, tiles via env, **fit-to-clients**, **clustering**
  de densidade, estado vazio, selo de **bateria baixa**), `/declines`, geofences
  (`GET/POST/DELETE /location/geofences`), `GET /location/debtors/:id/consent|history`.
- Retenção de pings por job diário.

### 8.6 App do sobrinho (PWA) — `/me`, `/viagem`, `/local`, `/perfil`, entrada `/d/[token]`
Identidade acolhedora (paleta quente, Baloo 2 + DM Sans, avatares, ícones amigáveis). Navegação 4 abas:
- **Início/Conexões** (`/me`): conexão com o padrinho + resumo leve da viagem.
- **Viagem** (`/viagem`): "Valor combinado / Já resolvido / Ainda falta" (trilha), com quem é,
  **"Já resolvi"** (cria PaymentClaim), timeline gentil. Dados: `GET /debtor/me/debts`.
- **Localização** (`/local`): opt-in de confiança.
- **Perfil** (`/perfil`): conexão, atalho de localização, sair.
Copy sem termos de cobrança/dívida/risco/vigilância.

### 8.7 Admin / super-admin — `/admin/*`
`GET /admin/overview` (KPIs: credores total/ativos/bloqueados/pendentes, novos hoje, **loginFailures24h**),
`/events`, `/creditors`, `/tenants`, `/users`, `/admins`, `/access-links`, `/audit`. Ações: aprovar/
rejeitar/suspender/reativar/bloquear/excluir tenant, force-logout, password-reset, promover/revogar
admin, revogar link. Home do admin: aprovações pendentes + **alerta de segurança** (logins falhos 24h).

### 8.8 Termos + preferências (credor)
1º acesso: aceite único de termos (`POST /auth/accept-terms`, gate /termos) + convite de resumo
semanal (aceitar/negar; modal no Shell; alterável em `/configuracoes`; `POST /auth/notification-prefs`).

## 9. API (todos os endpoints)

```
GET  /health
# Auth/credor
POST /auth/register-creditor      GET  /auth/me      POST /auth/accept-terms
POST /auth/notification-prefs     POST /auth/debtor/exchange
# Devedor (sobrinho)
GET  /debtor/me/debts             POST /debtor/me/debts/:debtId/claim   POST /debtor/me/push-token
GET  /debtor/me/location/consent  POST /debtor/me/location/consent      POST /debtor/me/location/ping
# Dívidas (credor)
POST /debts/preview  POST /debts  POST /debts/quick  GET /debts  GET /debts/trash
GET  /debts/claims/pending  POST /debts/claims/:id/confirm  POST /debts/claims/:id/reject
GET  /debts/:id  GET /debts/:id/summary  GET /debts/:id/history
PATCH /debts/:id/tags  PATCH /debts/:id/dates  POST /debts/:id/payments  POST /debts/:id/renegotiate
POST /debts/:id/restore  DELETE /debts/:id
# Devedores (provisionamento pelo credor)
POST /debtors  GET /debtors  POST /debtors/:id/revoke  POST /debtors/:id/reactivate
POST /debtors/:id/rotate-link  GET /debtors/:id/logins
# Dashboard
GET /dashboard/kpis  /portfolio  /copilot  /intelligence
# Notificações
GET /notifications  POST /notifications/generate  POST /notifications/weekly-digest  PATCH /notifications/:id/read
# Relatórios
GET /reports  POST /reports/generate
# Localização (credor)
GET /location/positions  /declines  /geofences  POST /location/geofences  DELETE /location/geofences/:id
GET /location/debtors/:id/consent  /location/debtors/:id/history
# Tracking
POST /events/session  POST /public/events/login-failed
# Admin (@Roles SUPER_ADMIN)
GET  /admin/{overview,events,creditors,access-links,tenants,users,admins,audit,tenants/:id/operations}
POST /admin/tenants/:id/{approve,reject,suspend,reactivate,block,unblock}  DELETE /admin/tenants/:id
POST /admin/access-links/:id/revoke  /admin/users/:id/{force-logout,password-reset}
POST /admin/admins/:id/{revoke,promote}
```

## 10. Frontend (rotas Next.js)

Entrada `/` (client): roteia por sessão (Supabase→painel por papel; JWT devedor→/me; senão /login).
Rotas: /login, /register, /dashboard, /carteira, /operacoes/nova, /operacoes/[id], /devedores,
/notificacoes, /recebiveis, /vencimentos, /relatorios, /relatorio, /localizacao, /configuracoes,
/lixeira, /termos, /pendente; admin: /admin(+admins, aprovacoes, auditoria, credores, credores/[id],
executivo, links, monitoramento, notificacoes, seguranca, sessoes, usuarios); sobrinho: /me, /viagem,
/local, /perfil, /d/[token]. **PWA**: `manifest.webmanifest` (start_url "/" roteado por papel),
service worker (network-first, fallback "/"). Tema escuro "Torre de Controle" (credor/admin) vs tema
claro acolhedor (sobrinho).

## 11. Jobs agendados (cron)

| Job | Quando | O quê |
|---|---|---|
| StatsScheduler | diário 4h | materializa TenantStats |
| RetentionScheduler | diário 3h | purga lixeira/pings/snapshots antigos |
| NotificationsScheduler | diário 8h | alertas de vencimento + "sem sinal" (localização) |
| WeeklyDigestScheduler | segunda 8h | resumo semanal (quem optou) |
| ReportsScheduler | dia 1, 5h | arquiva relatório mensal |

## 12. Deploy e variáveis de ambiente

- **Railway** (API): `DATABASE_URL` (pooler; role `pacific_app` em prod), `SUPABASE_JWT_SECRET`,
  `APP_JWT_SECRET`, `WEB_ORIGIN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RLS_STRICT`,
  `SENTRY_DSN?`, `REDIS_URL?`, `THROTTLE_*?`, `LOCATION_*?`, `*_RETENTION_DAYS?`. **`DIRECT_URL`
  omitido de propósito** (pula migrate no boot).
- **Vercel** (web): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `NEXT_PUBLIC_SENTRY_DSN?`, `NEXT_PUBLIC_MAP_TILE_URL?`, `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION?`.
- **Supabase** (DB): migrações 0–22 e `rls.sql` aplicados manualmente; role `pacific_app` sem
  BYPASSRLS. Plano FREE hoje (sem PITR → DR limitado; ver docs/DR_RUNBOOK.md, RLS_RUNBOOK.md).

## 13. Estado atual e pendências

Entregue e no ar (branch principal): carteira/operações, motor financeiro, dashboard/IA, notificações
(vencimento + eventos do sobrinho + resumo semanal in-app), relatórios, localização consentida (painel
+ app + mapa com clustering), app do sobrinho reposicionado (rede de confiança), admin, RLS estrito
(C1), data inicial editável, opt-in de resumo semanal. Migrações até a **22**.

**Pendências / decisões abertas:**
- **Envio por PUSH** (navegador) do resumo semanal: hoje é in-app; push real (VAPID + subscription +
  service worker) é camada opcional, instável no iOS.
- **Upgrades major** (Nest 11 / Next 15 / Sentry 10): validados numa branch (`chore/major-upgrades`,
  PR aberto), não mergeados.
- **DR**: Supabase FREE (sem PITR); avaliar plano Pro + teste de restore.
- **Billing/cobrança** do SaaS: não implementado.
- **App nativo + GPS em segundo plano**: só via app nativo (Capacitor/Android sideload); PWA não faz
  background. iOS não permite distribuição fora da loja.
- **CI** (.github/workflows/ci.yml): adicionar via GitHub (escopo workflow).

## 14. Fora de escopo (por decisão)

E-mail/WhatsApp (notificações são in-app); rastreamento sem consentimento; ver senhas (reset+auditoria);
detecção literal de desinstalação (usa proxy "sem sinal").

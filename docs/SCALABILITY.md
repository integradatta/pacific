# Escalabilidade & Arquitetura

Como a plataforma cresce sem reescritas. Decisões atuais + caminhos preparados.

## Princípios

- **Stateless API** (NestJS): qualquer instância atende qualquer request → escala horizontal (mais réplicas).
- **Pooler de conexões** (Supabase pgbouncer, porta 6543) no runtime; migrações usam conexão de sessão (`DIRECT_URL`).
- **Isolamento multi-tenant** por RLS no Postgres (`app.current_tenant` via `withTenant`), não só no app — isolamento real mesmo sob bug de aplicação.
- **Cliente cacheia** (React Query: `staleTime` 30s, sem refetch ao focar) → menos rajadas sob muitos usuários.

## Banco de dados

- **Índices** nos caminhos quentes: `Debt(tenantId)`, `Debt(debtorId)`, `Debt(tenantId, dueDate)`,
  `Notification(tenantId)`, `Notification(tenantId, createdAt)`, `PlatformEvent(at | tenantId,at | type,at)`,
  `AdminAuditLog(createdAt)`, `DebtorLoginEvent(tenantId | debtorId,at)`. (migração `10_scale_indexes`)
- **Listas limitadas**: toda lista cross-tenant do admin tem `limit/offset` com teto (`clampTake` ≤500) —
  nunca carrega tabela inteira. Notificações já paginam (`Page<T>`).
- **Append-only** para auditoria/eventos (`AdminAuditLog`, `PlatformEvent`): escrita barata, leitura por índice de data.

## Multi-tenant em escala

- Carteira de um credor é **bounded** (consultas escopadas por `tenantId`, indexadas). O dashboard/inteligência
  carrega só as dívidas do tenant — escala por tenant, não pela base toda.
- **Agregação cross-tenant (RESOLVIDA):** antes, `overview()` varria todas as dívidas de todos os credores
  a cada acesso (o saldo com juros é **computado**, não armazenado). Agora:
  - **`TenantStats`** (1 linha por tenant) recalculada por um **job diário** (`StatsScheduler @4h`) — a
    computação cara roda fora do request. `overview()` **lê e soma** as stats (O(tenants)); fallback ao
    cálculo vivo só antes do 1º refresh. Defasagem ≤24h no overview (o dashboard do credor é sempre vivo).
  - `overview()` ainda usa `count()` p/ as contagens + **cache TTL 60s**; `creditors()` é **paginado**.

## Modularidade

- Monorepo Turborepo: `packages/{shared,api,database}` + `apps/*`. Regras de negócio puras em `@pacific/shared`
  (motor financeiro/inteligência) — testáveis sem DB e reutilizadas por API e web.
- Módulos NestJS por domínio (creditors, debts, dashboard, notifications, admin, tracking, auth) com DI →
  novos módulos (tipos de operação, perfis, dashboards, relatórios) entram sem refatorar os existentes.
- **Localização** já é um módulo desacoplado e inerte (`location.module` + tokens) — ponto de extensão.

## Observabilidade (fundação)

- **Log estruturado** por requisição (`LoggingInterceptor`: método/rota/status/ms em JSON) — coletável por
  qualquer agregador sem mudar o app.
- **Erros 5xx** capturados no log de eventos (`AllExceptionsFilter` → `PlatformEvent type=ERROR`) → tela de Monitoramento.
- **Trilhas**: `AdminAuditLog` (ações do admin) + `PlatformEvent` (atividade da plataforma) — base p/ auditoria avançada/métricas.

## APIs & integrações

- Contratos tipados ponta a ponta via `@pacific/shared` (mesmos tipos no back e no front) → mudanças quebram no build, não em produção.
- **Versionamento**: quando expor a API a terceiros, prefixar com `setGlobalPrefix('v1')` e versionar contratos por pasta;
  hoje o consumidor é só o web do monorepo (contrato compartilhado), então o custo de versionar ainda não se paga.
- Integrações externas entram como **providers** atrás de tokens (ex.: `AUTH_ADMIN`, `LOCATION_PROVIDER`) — trocáveis sem tocar o domínio.

## Checklist ao crescer (10 → 100k)

- Listas extensas: confirmar `limit/offset` (ou cursor) e busca **server-side** quando a base passar do teto da página.
- Agregações cross-tenant: migrar para `TenantStats` materializada (acima).
- Cache: subir o TTL/!mover para Redis se o overview/admin virar hot path.

## Schedulers em múltiplas réplicas (auditoria)

Cada réplica roda o `@nestjs/schedule` de forma independente → um `@Cron` dispara **uma vez por réplica**.
Hoje a produção é **réplica única** (sem problema). **ANTES de escalar horizontalmente**, tratar os
schedulers **não-idempotentes** (marcados abaixo). Referência de guarda já existente:
`notifications.service.ts` usa `pg_advisory_xact_lock(hashtext(tenant), 'weekly_digest')`.

| Scheduler | Efeito | Multi-réplica |
|---|---|---|
| `notifications.scheduler` (8h) | gera réguas de vencimento | ✅ idempotente (upsert por debtId/type) |
| `portfolio-snapshot` (5h) | snapshot semanal | ✅ idempotente (unique tenant/semana) |
| `forecast.scheduler` (mensal) | ForecastMonth | ✅ idempotente (unique tenant/mês) |
| `stats.scheduler` (4h) | TenantStats | ✅ idempotente (overwrite) |
| `retention.scheduler` (3h) | expurgo | ✅ idempotente (delete-where) |
| `weekly-digest` (seg 8h) | push semanal | ✅ protegido (advisory lock por tenant) |
| **`daily-push` (8h BRT)** | **Web Push diário** | ⚠️ **NÃO idempotente** → push duplicado |
| **`promises.service` (6h BRT)** | resolve promessas + push | ⚠️ **NÃO idempotente** → push/contagem duplicados |

**Correção recomendada (quando escalar):** guarda de execução única por (job, dia). Opções: (a) tabela de
idempotência `ScheduledRun(job, runDate UNIQUE)` — INSERT falha na 2ª réplica → pula (robusto com pooler);
(b) advisory lock em conexão fixada. **É decisão arquitetural** (pooler do Prisma dificulta lock de sessão) —
não aplicada ainda por não haver bug em réplica única.

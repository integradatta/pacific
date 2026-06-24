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
- **Gargalo conhecido** (documentado, não crítico hoje): `overview()` e `creditors()` do super-admin agregam
  cross-tenant chamando `kpis()` por tenant (o saldo com juros é **computado**, não armazenado). Mitigações já aplicadas:
  - `overview()`: contagens via `count()` (indexado) + **cache TTL 60s** (admins concorrentes não recomputam).
  - `creditors()`: **paginado** → o N+1 fica limitado ao tamanho da página.
- **Stats materializadas (FEITO):** tabela **TenantStats** por tenant
  (`TenantStats`: principal, contagens, recebido) atualizada nas mutações de dívida (create/pay/update) +
  `PortfolioSnapshot` (já existe, semanal) para histórico. Aí `overview()` lê N linhas agregadas, sem tocar `Debt`.

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
- Réplicas de API: o cron de alertas é idempotente (upsert) — seguro com N instâncias.
- Cache: subir o TTL/!mover para Redis se o overview/admin virar hot path.

# geo-api — Módulo de Geolocalização em Grupo (Fase 2)

Módulo **independente** do financeiro (schema `geo`, sem FK para `Debtor`/`Debt`; tenant/user
vêm do JWT). Spec: [`../../docs/superpowers/specs/2026-06-21-gps-spec.md`](../../docs/superpowers/specs/2026-06-21-gps-spec.md)
· Arquitetura: [`../../docs/superpowers/specs/2026-06-21-gps-phase1-architecture.md`](../../docs/superpowers/specs/2026-06-21-gps-phase1-architecture.md)

## Status da construção (incremental, em `feat/geo-module`)
- ✅ **Increment 1** — `packages/geo-shared`: lógica pura de domínio + 39 testes (regras de grupo/papéis, consentimento, geofence anti-bounce, validação de pontos, geocoding, notificações).
- ✅ **Increment 2** — migrations SQL do schema `geo` (PostGIS, enums, tabelas, índices GiST, RLS). **Este diretório.**
- ✅ **Increment 3** — app NestJS: guards (JWT assumindo claim `tenant_id`, rate-limit in-memory), `GeoDb` tenant-scoped (RLS via `app.current_tenant`), módulos `groups`/`sharing`/`locations`/`geofencing` (REST + DTOs) consumindo o `geo-shared`. **18 testes** (regras com DB mockado) + typecheck ✓.
- ⏳ **Increment 4** — WebSocket gateway + jobs (agregação 6h, DBSCAN, purge, cache de geocoding).
- ⏳ **Increments 5–7** — mobile RN, dashboard web, FCM (precisam de device/Firebase p/ validar).

> A camada espacial (SQL PostGIS) é exercida só contra o Supabase; a lógica de regras está
> coberta por testes com DB mockado aqui + os 39 testes puros do `@pacific/geo-shared`.

## Migrations (`./migrations`)
Raw SQL (PostGIS não é tipado pelo Prisma). Ordem:
1. `0001_geo_init.sql` — extensão PostGIS, schema `geo`, enums, tabelas, índices.
2. `0002_geo_rls.sql` — RLS por tenant (aplicar após o init; e após seeds, se houver).

Aplicar no Supabase (free tier tem PostGIS):
```bash
psql "$DATABASE_URL" -f apps/geo-api/migrations/0001_geo_init.sql
psql "$DATABASE_URL" -f apps/geo-api/migrations/0002_geo_rls.sql
# validar PostGIS:  SELECT PostGIS_Version();
```

> ⚠️ **Validação:** o Postgres efêmero usado nos e2e do core **não tem PostGIS**, então estas
> migrations só são validadas de verdade contra o Supabase. A lógica de domínio (sem banco) está
> coberta por testes em `@pacific/geo-shared`.

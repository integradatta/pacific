# geo-api — Módulo de Geolocalização em Grupo (Fase 2)

Módulo **independente** do financeiro (schema `geo`, sem FK para `Debtor`/`Debt`; tenant/user
vêm do JWT). Spec: [`../../docs/superpowers/specs/2026-06-21-gps-spec.md`](../../docs/superpowers/specs/2026-06-21-gps-spec.md)
· Arquitetura: [`../../docs/superpowers/specs/2026-06-21-gps-phase1-architecture.md`](../../docs/superpowers/specs/2026-06-21-gps-phase1-architecture.md)

## Status da construção (incremental, em `feat/geo-module`)
- ✅ **Increment 1** — `packages/geo-shared`: lógica pura de domínio + 39 testes (regras de grupo/papéis, consentimento, geofence anti-bounce, validação de pontos, geocoding, notificações).
- ✅ **Increment 2** — migrations SQL do schema `geo` (PostGIS, enums, tabelas, índices GiST, RLS). **Este diretório.**
- ⏳ **Increment 3** — app NestJS (guards JWT/tenant/roles, módulos groups/locations/geofencing/consent, REST, throttler).
- ⏳ **Increments 4–7** — WebSocket + jobs (agregação 6h/DBSCAN/purge), mobile RN, dashboard web, FCM.

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

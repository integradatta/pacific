# geo-api — Módulo de Geolocalização em Grupo (Fase 2)

Módulo **independente** do financeiro (schema `geo`, sem FK para `Debtor`/`Debt`; tenant/user
vêm do JWT). Spec: [`../../docs/superpowers/specs/2026-06-21-gps-spec.md`](../../docs/superpowers/specs/2026-06-21-gps-spec.md)
· Arquitetura: [`../../docs/superpowers/specs/2026-06-21-gps-phase1-architecture.md`](../../docs/superpowers/specs/2026-06-21-gps-phase1-architecture.md)

## Status da construção (incremental, em `feat/geo-module`)
- ✅ **Increment 1** — `packages/geo-shared`: lógica pura de domínio + 39 testes (regras de grupo/papéis, consentimento, geofence anti-bounce, validação de pontos, geocoding, notificações).
- ✅ **Increment 2** — migrations SQL do schema `geo` (PostGIS, enums, tabelas, índices GiST, RLS). **Este diretório.**
- ✅ **Increment 3** — app NestJS: guards (JWT assumindo claim `tenant_id`, rate-limit in-memory), `GeoDb` tenant-scoped (RLS via `app.current_tenant`), módulos `groups`/`sharing`/`locations`/`geofencing` (REST + DTOs) consumindo o `geo-shared`. **18 testes** (regras com DB mockado) + typecheck ✓.
- ✅ **Increment 4** — tempo real + jobs: `LocationsGateway` (socket.io, namespace `/ws/locations`, rooms por grupo, JWT no handshake) via `RealtimePublisher` (serviços publicam `location_update`/`geofence_alert`/`status_change`/`member_joined|left`); `JobsService` (@Cron) agregação 6h + DBSCAN diário + purge com **degradação por storage** (`retentionPlan` no geo-shared) + limpeza de cache; `GET /api/v1/admin/storage-status`. SQL espacial/cron valida no Supabase.
- ✅ **Increment 7** — notificações: `PushSender` (abstração) com `FcmPushSender` (firebase-admin, init lazy) e `NoopPushSender` (default sem credenciais); `NotificationsService` (supervised → admins; collaborative → demais membros só com consenso) ligado a `status_change` e `geofence_alert`; `POST /api/v1/devices` (registro de push token). 4 testes de destinatários.
- ✅ **Increment 5** (mobile) e ✅ **6** (dashboard) — ver `apps/geo-mobile` e `apps/geo-dashboard`.

### Setup do FCM (Firebase) — para o push funcionar de verdade
Crie um projeto Firebase (grátis), gere uma **service account** e exponha ao geo-api uma das:
`FIREBASE_SERVICE_ACCOUNT` (JSON inline) ou `GOOGLE_APPLICATION_CREDENTIALS` (caminho do arquivo).
Sem isso, o `createPushSender()` usa o `NoopPushSender` (loga, não envia) — o resto funciona.
No app mobile, configure `google-services.json` (Android) / `GoogleService-Info.plist` (iOS) e
registre o token via `POST /api/v1/devices`.

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

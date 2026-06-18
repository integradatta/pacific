# Pacific — Fase 1B (Fundação ampliada) — Implementation Plan

> Continuação da Fase 1 após a base de onboarding. Tudo `tenant-scoped`, paginado, TS estrito, TDD onde há lógica.

**Escopo:** dívidas → cálculo automático → dashboard básico do credor → notificações base. Sem recursos avançados (heat map, torre de controle, localização, realtime, scores avançados) ainda.

## Tasks

### T12 — Dívidas (schema + cadastro CRUD)
- Estende `schema.prisma`: enums `DebtStatus`(GREEN/YELLOW/ORANGE/RED), `RatePeriod`(MONTHLY/ANNUAL); model `Debt` (tenantId, debtorId, description?, principal Decimal(14,2), rate Decimal(9,6), ratePeriod, currency, startDate, dueDate, status, timestamps) + índices `tenantId`/`debtorId`; relações em Tenant/Debtor.
- Regenera `migrations/0_init/migration.sql` offline (`prisma migrate diff --from-empty`), pois nenhum DB foi aplicado ainda.
- API: `DebtsService` (create/list paginado/get — todos com filtro `tenantId`), `DebtsController` (`POST /debts`, `GET /debts?limit&offset`, `GET /debts/:id`) protegido por `JwtGuard`+`TenantGuard`+`RolesGuard(CREDITOR)`. DTO com class-validator. Testes do service (escopo por tenant, paginação).

### T13 — Motor financeiro (cálculo automático)
- `@pacific/shared` (Decimal.js): `balanceOf(debt, asOf)`, `accruedInterest`, `daysUntil/daysOverdue`, `deriveStatus` (semáforo), `projections` (hoje/30/90/180/365). Juros compostos, taxa normalizada por `ratePeriod`. TDD com casos determinísticos.
- API: `GET /debts/:id/summary` devolve saldo/juros/dias/status/projeções calculados.

### T14 — Dashboard básico do credor
- API: `GET /dashboard/kpis` (total emprestado, a receber, vencido, contagem por status) tenant-scoped.
- Web mínimo (`apps/web`, Next 14): login + página de KPIs + lista paginada de dívidas. Loading/empty/error states.

### T15 — Notificações (base)
- Schema: `Notification` (tenantId, debtorId?, debtId?, title, body, readAt?, createdAt).
- API: geração por vencimento (serviço determinístico) + `GET /notifications` paginado (central). Push/cron/OneSignal ficam para fase posterior.

Cada task: TDD onde há lógica, `tenant-scoped`, paginação obrigatória, sem `any`, commit próprio. Migrações regeneradas offline enquanto não houver DB.

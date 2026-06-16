# Pacific — Fase 1 (Setup, Schema, Auth, Multi-tenancy) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estabelecer o monorepo Turborepo, o schema completo do banco (Prisma), o ambiente Docker, a autenticação via Supabase e o isolamento multi-tenant (escopo no NestJS + RLS), entregando uma API que sobe, valida JWT e isola dados por credor.

**Architecture:** Monorepo Turborepo com `packages/shared` (tipos/utils), `packages/database` (Prisma), `packages/api` (NestJS). Tenant = credor; todo dado de negócio carrega `tenantId`. Isolamento em duas camadas: guard de tenant no NestJS + Row-Level Security no Postgres (Supabase). Auth por JWT do Supabase validado por um guard.

**Tech Stack:** Turborepo, TypeScript estrito, NestJS, Prisma, PostgreSQL (Supabase), Vitest, Docker (Postgres + Redis), Decimal (Prisma `Decimal`).

**Spec:** `docs/superpowers/specs/2026-06-16-pacific-design.md`

---

## File Structure (Fase 1)

```
Pacific/
├── package.json                       # workspaces, scripts turbo
├── turbo.json                         # pipeline de tasks
├── tsconfig.base.json                 # TS estrito compartilhado
├── docker-compose.yml                 # postgres + redis (dev local)
├── .env.example                       # todas as variáveis
├── README.md                          # setup
├── packages/
│   ├── shared/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       ├── index.ts
│   │       ├── types/{debt,financial,location}.types.ts
│   │       └── utils/{date.utils.ts,date.utils.test.ts}
│   ├── database/
│   │   ├── package.json
│   │   ├── schema.prisma
│   │   ├── prisma/migrations/
│   │   ├── src/{client.ts,rls.sql}
│   │   └── seed.ts
│   └── api/
│       ├── package.json
│       ├── tsconfig.json
│       ├── nest-cli.json
│       └── src/
│           ├── main.ts
│           ├── app.module.ts
│           ├── common/{http-exception.filter.ts,prisma.service.ts}
│           ├── auth/{auth.module.ts,jwt.guard.ts,jwt.guard.test.ts,current-user.decorator.ts,auth.types.ts}
│           └── tenants/{tenant.guard.ts,tenant.guard.test.ts,tenant-context.ts}
```

---

### Task 1: Scaffold do monorepo

**Files:**
- Create: `package.json`, `turbo.json`, `tsconfig.base.json`, `.nvmrc`

- [ ] **Step 1: Criar `package.json` raiz**

```json
{
  "name": "pacific",
  "private": true,
  "version": "0.1.0",
  "workspaces": ["apps/*", "packages/*"],
  "packageManager": "npm@11.13.0",
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "db:generate": "npm run db:generate -w @pacific/database",
    "db:migrate": "npm run db:migrate -w @pacific/database",
    "db:seed": "npm run db:seed -w @pacific/database"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: Criar `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": {},
    "test": { "dependsOn": ["^build"] },
    "db:generate": { "cache": false }
  }
}
```

- [ ] **Step 3: Criar `tsconfig.base.json` (estrito)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 4: Criar `.nvmrc`** com o conteúdo `20`.

- [ ] **Step 5: Instalar e verificar**

Run: `npm install && npx turbo --version`
Expected: turbo imprime a versão (ex.: `2.x.x`) sem erro.

- [ ] **Step 6: Commit**

```bash
git add package.json turbo.json tsconfig.base.json .nvmrc package-lock.json
git commit -m "chore: scaffold do monorepo turborepo"
```

---

### Task 2: `packages/shared` — tipos e utils de data (TDD)

**Files:**
- Create: `packages/shared/package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`, `src/types/*.ts`, `src/utils/date.utils.ts`
- Test: `packages/shared/src/utils/date.utils.test.ts`

- [ ] **Step 1: Criar `packages/shared/package.json`**

```json
{
  "name": "@pacific/shared",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "lint": "tsc --noEmit",
    "build": "tsc -p tsconfig.json"
  },
  "devDependencies": { "vitest": "^2.0.0" }
}
```

- [ ] **Step 2: Criar `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

- [ ] **Step 3: Criar `packages/shared/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } });
```

- [ ] **Step 4: Escrever o teste que falha — `src/utils/date.utils.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { daysBetween, daysUntil } from './date.utils';

describe('daysBetween / daysUntil', () => {
  it('conta dias entre duas datas (UTC, sem horas)', () => {
    expect(daysBetween(new Date('2026-06-16T10:00:00Z'), new Date('2026-06-26T01:00:00Z'))).toBe(10);
  });
  it('daysUntil é positivo para data futura', () => {
    expect(daysUntil(new Date('2026-06-26T00:00:00Z'), new Date('2026-06-16T00:00:00Z'))).toBe(10);
  });
  it('daysUntil é negativo para data vencida', () => {
    expect(daysUntil(new Date('2026-06-13T00:00:00Z'), new Date('2026-06-16T00:00:00Z'))).toBe(-3);
  });
});
```

- [ ] **Step 5: Rodar o teste e confirmar a falha**

Run: `npm test -w @pacific/shared`
Expected: FAIL — `Cannot find module './date.utils'`.

- [ ] **Step 6: Implementar `src/utils/date.utils.ts`**

```ts
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((toUtcMidnight(to) - toUtcMidnight(from)) / MS_PER_DAY);
}

export function daysUntil(target: Date, from: Date = new Date()): number {
  return daysBetween(from, target);
}
```

- [ ] **Step 7: Criar os tipos compartilhados**

`src/types/debt.types.ts`:
```ts
export type DebtStatus = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
export type RatePeriod = 'MONTHLY' | 'ANNUAL';
export type UserRole = 'CREDITOR' | 'DEBTOR';

export interface DebtSummary {
  id: string;
  debtorName: string;
  principal: string;       // valor monetário como string (Decimal)
  balance: string;
  accruedInterest: string;
  rate: string;
  ratePeriod: RatePeriod;
  dueDate: string;         // ISO
  daysRemaining: number;
  status: DebtStatus;
}
```

`src/types/financial.types.ts`:
```ts
export interface Projection { horizonDays: number; balance: string; }
export interface DebtScores { recoverability: number; temperature: number; }
```

`src/types/location.types.ts`:
```ts
export type ConsentState = 'GRANTED' | 'REVOKED' | 'NEVER';

export interface LivePosition {
  debtorId: string;
  lat: number;
  lng: number;
  recordedAt: string;      // ISO
  online: boolean;
  battery: number | null;  // 0-100
  status: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
}
```

- [ ] **Step 8: Criar `src/index.ts`**

```ts
export * from './types/debt.types.js';
export * from './types/financial.types.js';
export * from './types/location.types.js';
export * from './utils/date.utils.js';
```

- [ ] **Step 9: Rodar o teste e confirmar que passa**

Run: `npm test -w @pacific/shared`
Expected: PASS (3 testes).

- [ ] **Step 10: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): tipos compartilhados e utils de data com testes"
```

---

### Task 3: `packages/database` — schema Prisma completo

**Files:**
- Create: `packages/database/package.json`, `schema.prisma`, `src/client.ts`

- [ ] **Step 1: Criar `packages/database/package.json`**

```json
{
  "name": "@pacific/database",
  "version": "0.1.0",
  "main": "./src/client.ts",
  "scripts": {
    "db:generate": "prisma generate --schema=schema.prisma",
    "db:migrate": "prisma migrate dev --schema=schema.prisma",
    "db:deploy": "prisma migrate deploy --schema=schema.prisma",
    "db:seed": "tsx seed.ts",
    "lint": "prisma validate --schema=schema.prisma"
  },
  "dependencies": { "@prisma/client": "^5.18.0" },
  "devDependencies": { "prisma": "^5.18.0", "tsx": "^4.16.0" }
}
```

- [ ] **Step 2: Criar `packages/database/schema.prisma` (todas as entidades + enums)**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole       { CREDITOR DEBTOR }
enum DebtStatus     { GREEN YELLOW ORANGE RED }
enum RatePeriod     { MONTHLY ANNUAL }
enum LedgerEntryType{ INTEREST_ACCRUAL PAYMENT ADJUSTMENT PRINCIPAL }
enum AlertType      { D30 D15 D7 D3 D1 DUE OVERDUE }
enum AlertChannel   { PUSH IN_APP }
enum AlertStatus    { PENDING SENT FAILED }
enum ConsentState   { NEVER GRANTED REVOKED }
enum GeoEventType   { ARRIVAL DEPARTURE }

model Tenant {
  id         String   @id @default(uuid())
  name       String
  walletCode String   @unique
  createdAt  DateTime @default(now())
  users      User[]
  debtors    Debtor[]
  debts      Debt[]
  alerts     Alert[]
}

model User {
  id         String   @id @default(uuid())
  supabaseId String   @unique
  email      String   @unique
  role       UserRole
  tenantId   String?
  tenant     Tenant?  @relation(fields: [tenantId], references: [id])
  debtor     Debtor?
  createdAt  DateTime @default(now())
  @@index([tenantId])
}

model Debtor {
  id          String           @id @default(uuid())
  tenantId    String
  tenant      Tenant           @relation(fields: [tenantId], references: [id])
  userId      String?          @unique
  user        User?            @relation(fields: [userId], references: [id])
  name        String
  city        String?
  region      String?
  debts       Debt[]
  consent     LocationConsent?
  pings       LocationPing[]
  savedPlaces SavedPlace[]
  geoEvents   GeoEvent[]
  createdAt   DateTime         @default(now())
  @@index([tenantId])
}

model Debt {
  id          String        @id @default(uuid())
  tenantId    String
  tenant      Tenant        @relation(fields: [tenantId], references: [id])
  debtorId    String
  debtor      Debtor        @relation(fields: [debtorId], references: [id])
  description String?
  principal   Decimal       @db.Decimal(14, 2)
  rate        Decimal       @db.Decimal(9, 6)
  ratePeriod  RatePeriod    @default(MONTHLY)
  currency    String        @default("BRL")
  startDate   DateTime
  dueDate     DateTime
  status      DebtStatus    @default(GREEN)
  ledger      LedgerEntry[]
  snapshots   DebtSnapshot[]
  scores      Score[]
  alerts      Alert[]
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  @@index([tenantId])
  @@index([debtorId])
}

model LedgerEntry {
  id        String          @id @default(uuid())
  debtId    String
  debt      Debt            @relation(fields: [debtId], references: [id])
  type      LedgerEntryType
  amount    Decimal         @db.Decimal(14, 2)
  occurredAt DateTime
  note      String?
  createdAt DateTime        @default(now())
  @@index([debtId])
}

model DebtSnapshot {
  id              String   @id @default(uuid())
  debtId          String
  debt            Debt     @relation(fields: [debtId], references: [id])
  capturedAt      DateTime
  balance         Decimal  @db.Decimal(14, 2)
  accruedInterest Decimal  @db.Decimal(14, 2)
  @@unique([debtId, capturedAt])
  @@index([debtId])
}

model Score {
  id             String   @id @default(uuid())
  debtId         String
  debt           Debt     @relation(fields: [debtId], references: [id])
  recoverability Int
  temperature    Int
  computedAt     DateTime @default(now())
  @@index([debtId])
}

model Alert {
  id         String       @id @default(uuid())
  tenantId   String
  tenant     Tenant       @relation(fields: [tenantId], references: [id])
  debtId     String
  debt       Debt         @relation(fields: [debtId], references: [id])
  type       AlertType
  channel    AlertChannel
  status     AlertStatus  @default(PENDING)
  recipientRole UserRole
  scheduledFor DateTime
  sentAt     DateTime?
  notification Notification?
  createdAt  DateTime     @default(now())
  @@unique([debtId, type, recipientRole])
  @@index([tenantId])
}

model Notification {
  id        String   @id @default(uuid())
  alertId   String   @unique
  alert     Alert    @relation(fields: [alertId], references: [id])
  title     String
  body      String
  readAt    DateTime?
  createdAt DateTime @default(now())
}

model LocationConsent {
  id         String       @id @default(uuid())
  debtorId   String       @unique
  debtor     Debtor       @relation(fields: [debtorId], references: [id])
  state      ConsentState @default(NEVER)
  grantedAt  DateTime?
  revokedAt  DateTime?
  updatedAt  DateTime     @updatedAt
}

model LocationPing {
  id         String   @id @default(uuid())
  debtorId   String
  debtor     Debtor   @relation(fields: [debtorId], references: [id])
  lat        Float
  lng        Float
  online     Boolean  @default(true)
  battery    Int?
  accuracy   Float?
  recordedAt DateTime @default(now())
  @@index([debtorId, recordedAt])
}

model SavedPlace {
  id        String  @id @default(uuid())
  debtorId  String
  debtor    Debtor  @relation(fields: [debtorId], references: [id])
  label     String
  lat       Float
  lng       Float
  radiusM   Int     @default(150)
}

model GeoEvent {
  id        String       @id @default(uuid())
  debtorId  String
  debtor    Debtor       @relation(fields: [debtorId], references: [id])
  type      GeoEventType
  placeLabel String
  occurredAt DateTime    @default(now())
  @@index([debtorId, occurredAt])
}
```

- [ ] **Step 3: Criar `packages/database/src/client.ts`**

```ts
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();
export * from '@prisma/client';
```

- [ ] **Step 4: Gerar o client e validar o schema**

Run: `npm run db:generate -w @pacific/database && npm run lint -w @pacific/database`
Expected: `Generated Prisma Client` + `The schema is valid`.

- [ ] **Step 5: Commit**

```bash
git add packages/database
git commit -m "feat(database): schema prisma completo com entidades e enums"
```

---

### Task 4: Docker, variáveis de ambiente e migração inicial

**Files:**
- Create: `docker-compose.yml`, `.env.example`

- [ ] **Step 1: Criar `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: pacific
      POSTGRES_PASSWORD: pacific
      POSTGRES_DB: pacific
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
volumes:
  pgdata:
```

- [ ] **Step 2: Criar `.env.example`**

```bash
# Banco (dev local via docker-compose; em produção usar a string do Supabase)
DATABASE_URL="postgresql://pacific:pacific@localhost:5432/pacific?schema=public"

# Supabase
SUPABASE_URL=""
SUPABASE_ANON_KEY=""
SUPABASE_SERVICE_ROLE_KEY=""
SUPABASE_JWT_SECRET=""

# Redis / BullMQ
REDIS_URL="redis://localhost:6379"

# OneSignal (push) — opcional; ausência degrada para registro interno
ONESIGNAL_APP_ID=""
ONESIGNAL_API_KEY=""

# Mapbox (front)
NEXT_PUBLIC_MAPBOX_TOKEN=""

# API
API_PORT="3333"
```

- [ ] **Step 3: Criar a migração inicial** (requer Postgres no ar via Docker; em máquina sem Docker, apontar `DATABASE_URL` para o Supabase)

Run: `cp .env.example packages/database/.env && (docker compose up -d postgres || true) && npm run db:migrate -w @pacific/database -- --name init`
Expected: pasta `packages/database/prisma/migrations/<timestamp>_init/` criada e migração aplicada.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml .env.example packages/database/prisma/migrations
git commit -m "chore: docker-compose, .env.example e migração inicial"
```

---

### Task 5: `packages/api` — bootstrap NestJS, validação e erro padronizado

**Files:**
- Create: `packages/api/package.json`, `tsconfig.json`, `nest-cli.json`, `src/main.ts`, `src/app.module.ts`, `src/common/http-exception.filter.ts`, `src/common/prisma.service.ts`

- [ ] **Step 1: Criar `packages/api/package.json`**

```json
{
  "name": "@pacific/api",
  "version": "0.1.0",
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "node dist/main.js",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@nestjs/common": "^10.3.0",
    "@nestjs/core": "^10.3.0",
    "@nestjs/platform-express": "^10.3.0",
    "@pacific/database": "*",
    "@pacific/shared": "*",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.3.0",
    "@types/node": "^20.14.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Criar `packages/api/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "outDir": "dist",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "exactOptionalPropertyTypes": false
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Criar `packages/api/nest-cli.json`**

```json
{ "collection": "@nestjs/schematics", "sourceRoot": "src" }
```

- [ ] **Step 4: Criar `src/common/http-exception.filter.ts` (erro padronizado)**

```ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = exception instanceof HttpException ? exception.getResponse() : 'Internal server error';
    res.status(status).json({
      error: { status, message, timestamp: new Date().toISOString() },
    });
  }
}
```

- [ ] **Step 5: Criar `src/common/prisma.service.ts`**

```ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@pacific/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
}
```

- [ ] **Step 6: Criar `src/app.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { PrismaService } from './common/prisma.service.js';

@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
```

- [ ] **Step 7: Criar `src/main.ts`**

```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/http-exception.filter.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(Number(process.env.API_PORT ?? 3333));
}
void bootstrap();
```

- [ ] **Step 8: Verificar build**

Run: `npm install && npm run build -w @pacific/api`
Expected: build conclui sem erro de tipo.

- [ ] **Step 9: Commit**

```bash
git add packages/api package-lock.json
git commit -m "feat(api): bootstrap nestjs com validacao global e erro padronizado"
```

---

### Task 6: Auth — validação de JWT do Supabase (TDD)

**Files:**
- Create: `src/auth/auth.types.ts`, `src/auth/jwt.guard.ts`, `src/auth/current-user.decorator.ts`, `src/auth/auth.module.ts`
- Test: `src/auth/jwt.guard.test.ts`

- [ ] **Step 1: Criar `src/auth/auth.types.ts`**

```ts
import type { UserRole } from '@pacific/shared';

export interface AuthUser {
  supabaseId: string;
  email: string;
  role: UserRole;
  tenantId: string | null;
}

export interface RequestWithUser {
  headers: Record<string, string | undefined>;
  user?: AuthUser;
}
```

- [ ] **Step 2: Escrever o teste que falha — `src/auth/jwt.guard.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { JwtGuard } from './jwt.guard';
import type { ExecutionContext } from '@nestjs/common';

const SECRET = 'test-secret';

function ctx(headers: Record<string, string | undefined>): ExecutionContext {
  const req: { headers: typeof headers; user?: unknown } = { headers };
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

describe('JwtGuard', () => {
  let guard: JwtGuard;
  beforeEach(() => { guard = new JwtGuard(SECRET); });

  it('rejeita quando não há token', () => {
    expect(() => guard.canActivate(ctx({}))).toThrow();
  });

  it('aceita token válido e popula req.user', () => {
    const token = jwt.sign(
      { sub: 'sb-1', email: 'a@b.com', app_metadata: { role: 'CREDITOR', tenantId: 't1' } },
      SECRET,
    );
    const context = ctx({ authorization: `Bearer ${token}` });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejeita token assinado com segredo errado', () => {
    const token = jwt.sign({ sub: 'x' }, 'outro-segredo');
    expect(() => guard.canActivate(ctx({ authorization: `Bearer ${token}` }))).toThrow();
  });
});
```

- [ ] **Step 3: Adicionar deps e rodar o teste (deve falhar)**

Run: `npm i -w @pacific/api jsonwebtoken && npm i -D -w @pacific/api @types/jsonwebtoken && npm test -w @pacific/api`
Expected: FAIL — `Cannot find module './jwt.guard'`.

- [ ] **Step 4: Implementar `src/auth/jwt.guard.ts`**

```ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import type { AuthUser, RequestWithUser } from './auth.types.js';

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly secret: string = process.env.SUPABASE_JWT_SECRET ?? '') {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const header = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Token ausente');
    const token = header.slice('Bearer '.length);
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, this.secret) as jwt.JwtPayload;
    } catch {
      throw new UnauthorizedException('Token inválido');
    }
    const meta = (payload.app_metadata ?? {}) as { role?: string; tenantId?: string };
    const role = meta.role === 'DEBTOR' ? 'DEBTOR' : 'CREDITOR';
    const user: AuthUser = {
      supabaseId: String(payload.sub ?? ''),
      email: String(payload.email ?? ''),
      role,
      tenantId: meta.tenantId ?? null,
    };
    req.user = user;
    return true;
  }
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npm test -w @pacific/api`
Expected: PASS (3 testes).

- [ ] **Step 6: Criar `src/auth/current-user.decorator.ts`**

```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestWithUser } from './auth.types.js';

export const CurrentUser = createParamDecorator((_d: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<RequestWithUser>().user;
});
```

- [ ] **Step 7: Criar `src/auth/auth.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { JwtGuard } from './jwt.guard.js';

@Module({ providers: [{ provide: JwtGuard, useFactory: () => new JwtGuard() }], exports: [JwtGuard] })
export class AuthModule {}
```

- [ ] **Step 8: Commit**

```bash
git add packages/api/src/auth package-lock.json
git commit -m "feat(auth): guard de jwt do supabase com testes"
```

---

### Task 7: Multi-tenancy — guard de tenant e contexto (TDD)

**Files:**
- Create: `src/tenants/tenant-context.ts`, `src/tenants/tenant.guard.ts`
- Test: `src/tenants/tenant.guard.test.ts`

- [ ] **Step 1: Criar `src/tenants/tenant-context.ts`**

```ts
import type { AuthUser } from '../auth/auth.types.js';

export function resolveTenantId(user: AuthUser | undefined): string {
  if (!user) throw new Error('Usuário não autenticado');
  if (user.role !== 'CREDITOR' || !user.tenantId) throw new Error('Sem tenant de credor');
  return user.tenantId;
}
```

- [ ] **Step 2: Escrever o teste que falha — `src/tenants/tenant.guard.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { TenantGuard } from './tenant.guard';
import type { ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';

function ctx(user?: AuthUser): ExecutionContext {
  const req: { user?: AuthUser; tenantId?: string } = { user };
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

describe('TenantGuard', () => {
  const guard = new TenantGuard();
  it('rejeita credor sem tenantId', () => {
    expect(() => guard.canActivate(ctx({ supabaseId: 's', email: 'e', role: 'CREDITOR', tenantId: null }))).toThrow();
  });
  it('aceita credor com tenant e injeta req.tenantId', () => {
    const context = ctx({ supabaseId: 's', email: 'e', role: 'CREDITOR', tenantId: 't1' });
    expect(guard.canActivate(context)).toBe(true);
    expect((context.switchToHttp().getRequest() as { tenantId?: string }).tenantId).toBe('t1');
  });
});
```

- [ ] **Step 3: Rodar o teste (deve falhar)**

Run: `npm test -w @pacific/api`
Expected: FAIL — `Cannot find module './tenant.guard'`.

- [ ] **Step 4: Implementar `src/tenants/tenant.guard.ts`**

```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { RequestWithUser } from '../auth/auth.types.js';
import { resolveTenantId } from './tenant-context.js';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithUser & { tenantId?: string }>();
    try {
      req.tenantId = resolveTenantId(req.user);
    } catch (e) {
      throw new ForbiddenException((e as Error).message);
    }
    return true;
  }
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npm test -w @pacific/api`
Expected: PASS (todos os testes da api).

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/tenants
git commit -m "feat(tenants): guard de multi-tenancy com escopo por credor e testes"
```

---

### Task 8: Row-Level Security no Postgres

**Files:**
- Create: `packages/database/src/rls.sql`

- [ ] **Step 1: Criar `packages/database/src/rls.sql`**

```sql
-- Habilita RLS e isola por tenant via app.current_tenant (definido por SET LOCAL na conexão da API).
ALTER TABLE "Debtor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Debt"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Alert"  ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_debtor ON "Debtor"
  USING ("tenantId" = current_setting('app.current_tenant', true));
CREATE POLICY tenant_isolation_debt ON "Debt"
  USING ("tenantId" = current_setting('app.current_tenant', true));
CREATE POLICY tenant_isolation_alert ON "Alert"
  USING ("tenantId" = current_setting('app.current_tenant', true));
```

- [ ] **Step 2: Aplicar o SQL (requer banco no ar)**

Run: `psql "$DATABASE_URL" -f packages/database/src/rls.sql`
Expected: `ALTER TABLE` / `CREATE POLICY` sem erro. (Se `psql` indisponível, aplicar via SQL editor do Supabase.)

- [ ] **Step 3: Commit**

```bash
git add packages/database/src/rls.sql
git commit -m "feat(database): policies de RLS para isolamento por tenant"
```

---

### Task 9: Seed com dados fictícios realistas

**Files:**
- Create: `packages/database/seed.ts`

- [ ] **Step 1: Implementar `packages/database/seed.ts`**

```ts
import { PrismaClient, RatePeriod } from '@prisma/client';
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const tenant = await prisma.tenant.create({
    data: { name: 'Carteira Demo', walletCode: 'PAC-DEMO-001' },
  });

  const nomes = ['Ana Souza', 'Bruno Lima', 'Carla Dias', 'Diego Alves', 'Eva Martins'];
  for (let i = 0; i < nomes.length; i++) {
    const debtor = await prisma.debtor.create({
      data: { tenantId: tenant.id, name: nomes[i]!, city: 'Florianópolis', region: 'SC' },
    });
    const dueOffsetDays = [40, 20, 5, -3, 90][i]!;
    await prisma.debt.create({
      data: {
        tenantId: tenant.id,
        debtorId: debtor.id,
        description: `Empréstimo ${i + 1}`,
        principal: (5000 + i * 1500).toFixed(2),
        rate: '0.030000',
        ratePeriod: RatePeriod.MONTHLY,
        startDate: new Date('2026-05-01T00:00:00Z'),
        dueDate: new Date(Date.now() + dueOffsetDays * 86400000),
      },
    });
    await prisma.locationConsent.create({ data: { debtorId: debtor.id } });
  }
  console.log('Seed concluído: 1 tenant, 5 devedores, 5 dívidas.');
}

main().finally(() => void prisma.$disconnect());
```

- [ ] **Step 2: Rodar o seed (requer banco migrado)**

Run: `npm run db:seed -w @pacific/database`
Expected: `Seed concluído: 1 tenant, 5 devedores, 5 dívidas.`

- [ ] **Step 3: Commit**

```bash
git add packages/database/seed.ts
git commit -m "feat(database): seed com dados ficticios"
```

---

### Task 10: README e verificação final da Fase 1

**Files:**
- Create: `README.md`

- [ ] **Step 1: Criar `README.md`** com: visão do Pacific, stack, pré-requisitos (Node 20+, Docker, conta Supabase), passos `npm install` → `cp .env.example packages/database/.env` → `docker compose up -d` → `npm run db:migrate` → aplicar `rls.sql` → `npm run db:seed` → `npm run dev`, e a nota de que a localização é **simulada** (link para o spec).

- [ ] **Step 2: Verificação consolidada**

Run: `npm install && npm run lint && npm test`
Expected: lint sem erros de tipo; testes de `@pacific/shared` e `@pacific/api` passam.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README com setup da fase 1"
```

---

## Self-Review

**1. Cobertura do spec (Fase 1):** monorepo (T1) ✓ · shared types/utils (T2) ✓ · schema completo + enums incl. `RatePeriod`/Decimal (T3) ✓ · docker + .env + migração (T4) ✓ · NestJS + validação + erro padronizado (T5) ✓ · auth Supabase JWT (T6) ✓ · multi-tenancy guard (T7) ✓ · RLS (T8) ✓ · seed (T9) ✓ · README (T10) ✓. Motor financeiro, REST de recursos, WebSocket, alertas, web e mobile são fases 2–5 (decomposição intencional).

**2. Placeholders:** nenhum "TBD/TODO"; todo passo de código traz o código real.

**3. Consistência de tipos:** `AuthUser`/`RequestWithUser` usados igualmente em T6/T7; `DebtStatus`/`RatePeriod` iguais em `shared` (T2) e no Prisma (T3); `tenantId` injetado em `req` pelo `TenantGuard` consistente com `resolveTenantId`.

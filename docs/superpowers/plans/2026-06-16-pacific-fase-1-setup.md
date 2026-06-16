# Pacific — Fase 1 (Fundação multi-tenant) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validar a fundação multi-tenant: monorepo + modelo de dados base (Tenant/User/Debtor com `tenantId`, índices, isolamento), autenticação de 3 papéis, cadastro de credor com geração automática de `orgCode`, e resgate do código pelo devedor com auto-vínculo ao tenant — onboarding em < 1 min, sem pré-cadastro obrigatório.

**Architecture:** Monorepo Turborepo. Banco único Postgres; `tenantId` em toda tabela de negócio. Papéis: `SUPER_ADMIN` (sem tenant), `CREDITOR` (= 1 tenant), `DEBTOR` (vinculado ao tenant via `orgCode`). Acesso a dados via `TenantScopedService` + `TenantDatasourceResolver` (hoje 1 datasource; permite extração física futura). RLS como defesa em profundidade. Mitigações de segurança no servidor (alta entropia, rate limit, erros genéricos, rotação de código) sem etapas extras ao usuário.

**Tech Stack:** Turborepo, TypeScript estrito, NestJS, Prisma, PostgreSQL (Supabase), Vitest, Docker (Postgres + Redis).

**Spec:** `docs/superpowers/specs/2026-06-16-pacific-design.md`

---

## File Structure (Fase 1)

```
Pacific/
├── package.json · turbo.json · tsconfig.base.json · .nvmrc
├── docker-compose.yml · .env.example · README.md
├── packages/shared/src/
│   ├── types/{auth.types.ts,tenant.types.ts}
│   └── utils/{date.utils.ts(+test), org-code.ts(+test)}
├── packages/database/{schema.prisma, src/client.ts, src/rls.sql, seed.ts}
└── packages/api/src/
    ├── main.ts · app.module.ts
    ├── common/{http-exception.filter.ts, prisma.service.ts, pagination.ts}
    ├── auth/{auth.types.ts, jwt.guard.ts(+test), roles.guard.ts(+test), roles.decorator.ts, current-user.decorator.ts}
    ├── tenancy/{tenant-context.ts(+test), tenant.guard.ts(+test), tenant-datasource.resolver.ts, tenant-scoped.service.ts}
    ├── creditors/{creditors.service.ts(+test), creditors.controller.ts, dto/register-creditor.dto.ts}
    └── debtors/{redeem.service.ts(+test), debtors.controller.ts, redeem-rate-limit.guard.ts(+test), dto/redeem.dto.ts}
```

---

### Task 1: Scaffold do monorepo

**Files:** Create `package.json`, `turbo.json`, `tsconfig.base.json`, `.nvmrc`

- [ ] **Step 1: `package.json` raiz**

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
    "lint": "turbo run lint",
    "test": "turbo run test",
    "db:generate": "npm run db:generate -w @pacific/database",
    "db:migrate": "npm run db:migrate -w @pacific/database",
    "db:seed": "npm run db:seed -w @pacific/database"
  },
  "devDependencies": { "turbo": "^2.0.0", "typescript": "^5.5.0" }
}
```

- [ ] **Step 2: `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "lint": {},
    "test": { "dependsOn": ["^build"] },
    "db:generate": { "cache": false }
  }
}
```

- [ ] **Step 3: `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "NodeNext", "moduleResolution": "NodeNext",
    "lib": ["ES2022"], "strict": true, "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true, "declaration": true, "esModuleInterop": true,
    "skipLibCheck": true, "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 4:** Criar `.nvmrc` com `20`.

- [ ] **Step 5: Verificar** — Run: `npm install && npx turbo --version` → Expected: imprime versão sem erro.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "chore: scaffold do monorepo turborepo"`

---

### Task 2: `packages/shared` — tipos, date utils e gerador de orgCode (TDD)

**Files:** Create `packages/shared/{package.json,tsconfig.json,vitest.config.ts,src/index.ts,src/types/*.ts,src/utils/*.ts}`; Test: `src/utils/date.utils.test.ts`, `src/utils/org-code.test.ts`

- [ ] **Step 1: `packages/shared/package.json`**

```json
{
  "name": "@pacific/shared", "version": "0.1.0", "type": "module",
  "main": "./src/index.ts", "types": "./src/index.ts",
  "scripts": { "test": "vitest run", "lint": "tsc --noEmit", "build": "tsc -p tsconfig.json" },
  "devDependencies": { "vitest": "^2.0.0" }
}
```

- [ ] **Step 2: `packages/shared/tsconfig.json`**

```json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "outDir": "dist", "rootDir": "src" }, "include": ["src"] }
```

- [ ] **Step 3: `packages/shared/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } });
```

- [ ] **Step 4: Tipos — `src/types/auth.types.ts`**

```ts
export type UserRole = 'SUPER_ADMIN' | 'CREDITOR' | 'DEBTOR';

export interface AuthUser {
  supabaseId: string;
  email: string;
  role: UserRole;
  tenantId: string | null; // null apenas para SUPER_ADMIN
}
```

- [ ] **Step 5: Tipos — `src/types/tenant.types.ts`**

```ts
export type TenantStatus = 'ACTIVE' | 'SUSPENDED';

export interface TenantPublic {
  id: string;
  name: string;
  orgCode: string;
  status: TenantStatus;
}
```

- [ ] **Step 6: Teste que falha — `src/utils/date.utils.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { daysUntil } from './date.utils';

describe('daysUntil', () => {
  it('positivo no futuro', () => {
    expect(daysUntil(new Date('2026-06-26T00:00:00Z'), new Date('2026-06-16T00:00:00Z'))).toBe(10);
  });
  it('negativo se vencido', () => {
    expect(daysUntil(new Date('2026-06-13T00:00:00Z'), new Date('2026-06-16T00:00:00Z'))).toBe(-3);
  });
});
```

- [ ] **Step 7: Rodar (deve falhar)** — Run: `npm test -w @pacific/shared` → Expected: FAIL (módulo inexistente).

- [ ] **Step 8: Implementar `src/utils/date.utils.ts`**

```ts
const MS_PER_DAY = 86_400_000;
const utcMidnight = (d: Date): number => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
export function daysBetween(from: Date, to: Date): number {
  return Math.round((utcMidnight(to) - utcMidnight(from)) / MS_PER_DAY);
}
export function daysUntil(target: Date, from: Date = new Date()): number {
  return daysBetween(from, target);
}
```

- [ ] **Step 9: Teste que falha — `src/utils/org-code.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { generateOrgCode, ORG_CODE_REGEX, generateUniqueOrgCode } from './org-code';

describe('generateOrgCode', () => {
  it('gera no formato PAC-XXXX-XXXX em base32 de Crockford (sem I L O U)', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateOrgCode();
      expect(code).toMatch(ORG_CODE_REGEX);
      expect(code).not.toMatch(/[ILOU]/);
    }
  });
  it('gera valores distintos', () => {
    expect(generateOrgCode()).not.toBe(generateOrgCode());
  });
});

describe('generateUniqueOrgCode', () => {
  it('repete enquanto o código já existe e retorna o primeiro livre', async () => {
    const usados = new Set<string>();
    let chamadas = 0;
    const exists = async (c: string): Promise<boolean> => { chamadas++; return chamadas === 1 ? true : usados.has(c); };
    const code = await generateUniqueOrgCode(exists);
    expect(code).toMatch(ORG_CODE_REGEX);
    expect(chamadas).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 10: Rodar (deve falhar)** — Run: `npm test -w @pacific/shared` → Expected: FAIL (`org-code` inexistente).

- [ ] **Step 11: Implementar `src/utils/org-code.ts`**

```ts
import { randomInt } from 'node:crypto';

// Crockford base32 sem caracteres ambíguos (sem I, L, O, U).
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const ORG_CODE_REGEX = /^PAC-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

function block(): string {
  let out = '';
  for (let i = 0; i < 4; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export function generateOrgCode(): string {
  return `PAC-${block()}-${block()}`;
}

export async function generateUniqueOrgCode(
  exists: (code: string) => Promise<boolean>,
  maxAttempts = 10,
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateOrgCode();
    if (!(await exists(code))) return code;
  }
  throw new Error('Não foi possível gerar orgCode único');
}
```

- [ ] **Step 12: `src/index.ts`**

```ts
export * from './types/auth.types.js';
export * from './types/tenant.types.js';
export * from './utils/date.utils.js';
export * from './utils/org-code.js';
```

- [ ] **Step 13: Rodar e passar** — Run: `npm test -w @pacific/shared` → Expected: PASS (todos).

- [ ] **Step 14: Commit** — `git add packages/shared && git commit -m "feat(shared): tipos de auth/tenant, date utils e gerador de orgCode com testes"`

---

### Task 3: `packages/database` — schema base 3 níveis

**Files:** Create `packages/database/{package.json,schema.prisma,src/client.ts}`

- [ ] **Step 1: `packages/database/package.json`**

```json
{
  "name": "@pacific/database", "version": "0.1.0", "main": "./src/client.ts",
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

- [ ] **Step 2: `packages/database/schema.prisma` (base da Fase 1)**

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum UserRole     { SUPER_ADMIN CREDITOR DEBTOR }
enum TenantStatus { ACTIVE SUSPENDED }

model Tenant {
  id        String       @id @default(uuid())
  name      String
  orgCode   String       @unique
  status    TenantStatus @default(ACTIVE)
  createdAt DateTime     @default(now())
  users     User[]
  debtors   Debtor[]
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
  id         String    @id @default(uuid())
  tenantId   String
  tenant     Tenant    @relation(fields: [tenantId], references: [id])
  userId     String?   @unique
  user       User?     @relation(fields: [userId], references: [id])
  name       String
  email      String?
  redeemedAt DateTime?
  createdAt  DateTime  @default(now())
  @@index([tenantId])
  @@index([tenantId, email])
}
```

> Nota: Debt, LedgerEntry, Score, Alert, Notification e as entidades de localização entram na Fase 2+, sempre com `tenantId` indexado.

- [ ] **Step 3: `src/client.ts`**

```ts
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();
export * from '@prisma/client';
```

- [ ] **Step 4: Gerar e validar** — Run: `npm run db:generate -w @pacific/database && npm run lint -w @pacific/database` → Expected: client gerado + `schema is valid`.

- [ ] **Step 5: Commit** — `git add packages/database && git commit -m "feat(database): schema base 3 niveis (tenant/user/debtor)"`

---

### Task 4: Docker, env e migração inicial

**Files:** Create `docker-compose.yml`, `.env.example`

- [ ] **Step 1: `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment: { POSTGRES_USER: pacific, POSTGRES_PASSWORD: pacific, POSTGRES_DB: pacific }
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
volumes: { pgdata: {} }
```

- [ ] **Step 2: `.env.example`**

```bash
DATABASE_URL="postgresql://pacific:pacific@localhost:5432/pacific?schema=public"
SUPABASE_URL=""
SUPABASE_SERVICE_ROLE_KEY=""
SUPABASE_JWT_SECRET=""
REDIS_URL="redis://localhost:6379"
API_PORT="3333"
REDEEM_RATE_LIMIT="10"          # tentativas de resgate por janela
REDEEM_RATE_WINDOW_MS="600000"  # 10 min
```

- [ ] **Step 3: Migração inicial** — Run: `cp .env.example packages/database/.env && (docker compose up -d postgres || true) && npm run db:migrate -w @pacific/database -- --name init`
Expected: pasta `packages/database/prisma/migrations/<ts>_init/` criada. (Sem Docker, apontar `DATABASE_URL` para o Supabase.)

- [ ] **Step 4: Commit** — `git add docker-compose.yml .env.example packages/database/prisma && git commit -m "chore: docker-compose, env e migracao inicial"`

---

### Task 5: `packages/api` — bootstrap NestJS, validação, erro padronizado, paginação

**Files:** Create `packages/api/{package.json,tsconfig.json,nest-cli.json,src/main.ts,src/app.module.ts,src/common/http-exception.filter.ts,src/common/prisma.service.ts,src/common/pagination.ts}`

- [ ] **Step 1: `packages/api/package.json`**

```json
{
  "name": "@pacific/api", "version": "0.1.0",
  "scripts": { "build": "nest build", "dev": "nest start --watch", "start": "node dist/main.js", "test": "vitest run", "lint": "tsc --noEmit" },
  "dependencies": {
    "@nestjs/common": "^10.3.0", "@nestjs/core": "^10.3.0", "@nestjs/platform-express": "^10.3.0",
    "@pacific/database": "*", "@pacific/shared": "*",
    "class-transformer": "^0.5.1", "class-validator": "^0.14.1",
    "jsonwebtoken": "^9.0.2", "reflect-metadata": "^0.2.2", "rxjs": "^7.8.1"
  },
  "devDependencies": { "@nestjs/cli": "^10.3.0", "@types/jsonwebtoken": "^9.0.6", "@types/node": "^20.14.0", "vitest": "^2.0.0" }
}
```

- [ ] **Step 2: `tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "module": "commonjs", "moduleResolution": "node", "outDir": "dist", "experimentalDecorators": true, "emitDecoratorMetadata": true },
  "include": ["src"]
}
```

- [ ] **Step 3: `nest-cli.json`** → `{ "collection": "@nestjs/schematics", "sourceRoot": "src" }`

- [ ] **Step 4: `src/common/http-exception.filter.ts`**

```ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = exception instanceof HttpException ? exception.getResponse() : 'Internal server error';
    res.status(status).json({ error: { status, message, timestamp: new Date().toISOString() } });
  }
}
```

- [ ] **Step 5: `src/common/prisma.service.ts`**

```ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@pacific/database';
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit(): Promise<void> { await this.$connect(); }
}
```

- [ ] **Step 6: `src/common/pagination.ts`** (paginação obrigatória)

```ts
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit = 20;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  offset = 0;
}

export interface Page<T> { items: T[]; total: number; limit: number; offset: number; }
```

- [ ] **Step 7: `src/app.module.ts`** (módulos das tasks seguintes serão adicionados conforme criados)

```ts
import { Module } from '@nestjs/common';
import { PrismaService } from './common/prisma.service.js';
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class AppModule {}
```

- [ ] **Step 8: `src/main.ts`**

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

- [ ] **Step 9: Build** — Run: `npm install && npm run build -w @pacific/api` → Expected: sem erro de tipo.

- [ ] **Step 10: Commit** — `git add packages/api package-lock.json && git commit -m "feat(api): bootstrap nestjs com validacao, erro padronizado e paginacao"`

---

### Task 6: Auth — JWT (3 papéis) + RolesGuard (TDD)

**Files:** Create `src/auth/{auth.types.ts,jwt.guard.ts,roles.guard.ts,roles.decorator.ts,current-user.decorator.ts}`; Test: `src/auth/jwt.guard.test.ts`, `src/auth/roles.guard.test.ts`

- [ ] **Step 1: `src/auth/auth.types.ts`**

```ts
import type { AuthUser } from '@pacific/shared';
export type { AuthUser };
export interface RequestWithUser {
  headers: Record<string, string | undefined>;
  user?: AuthUser;
  tenantId?: string;
}
```

- [ ] **Step 2: Teste que falha — `src/auth/jwt.guard.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { JwtGuard } from './jwt.guard';
import type { ExecutionContext } from '@nestjs/common';

const SECRET = 'seg';
const ctx = (headers: Record<string, string | undefined>): ExecutionContext => {
  const req = { headers };
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
};

describe('JwtGuard', () => {
  let guard: JwtGuard;
  beforeEach(() => { guard = new JwtGuard(SECRET); });
  it('rejeita sem token', () => { expect(() => guard.canActivate(ctx({}))).toThrow(); });
  it('aceita token de credor e popula user', () => {
    const t = jwt.sign({ sub: 'sb1', email: 'c@x.com', app_metadata: { role: 'CREDITOR', tenantId: 't1' } }, SECRET);
    const c = ctx({ authorization: `Bearer ${t}` });
    expect(guard.canActivate(c)).toBe(true);
    expect((c.switchToHttp().getRequest() as { user?: { role: string } }).user?.role).toBe('CREDITOR');
  });
  it('super-admin tem tenantId null', () => {
    const t = jwt.sign({ sub: 'sb0', email: 'a@x.com', app_metadata: { role: 'SUPER_ADMIN' } }, SECRET);
    const c = ctx({ authorization: `Bearer ${t}` });
    guard.canActivate(c);
    expect((c.switchToHttp().getRequest() as { user?: { tenantId: string | null } }).user?.tenantId).toBeNull();
  });
  it('rejeita segredo errado', () => {
    const t = jwt.sign({ sub: 'x' }, 'outro');
    expect(() => guard.canActivate(ctx({ authorization: `Bearer ${t}` }))).toThrow();
  });
});
```

- [ ] **Step 3: Rodar (deve falhar)** — Run: `npm test -w @pacific/api` → Expected: FAIL (`./jwt.guard` inexistente).

- [ ] **Step 4: Implementar `src/auth/jwt.guard.ts`**

```ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import type { AuthUser } from '@pacific/shared';
import type { RequestWithUser } from './auth.types.js';

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly secret: string = process.env.SUPABASE_JWT_SECRET ?? '') {}
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const header = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Token ausente');
    let payload: jwt.JwtPayload;
    try { payload = jwt.verify(header.slice(7), this.secret) as jwt.JwtPayload; }
    catch { throw new UnauthorizedException('Token inválido'); }
    const meta = (payload.app_metadata ?? {}) as { role?: string; tenantId?: string };
    const role: AuthUser['role'] =
      meta.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : meta.role === 'DEBTOR' ? 'DEBTOR' : 'CREDITOR';
    req.user = {
      supabaseId: String(payload.sub ?? ''),
      email: String(payload.email ?? ''),
      role,
      tenantId: role === 'SUPER_ADMIN' ? null : (meta.tenantId ?? null),
    };
    return true;
  }
}
```

- [ ] **Step 5: `src/auth/roles.decorator.ts`**

```ts
import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@pacific/shared';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]): MethodDecorator => SetMetadata(ROLES_KEY, roles);
```

- [ ] **Step 6: Teste que falha — `src/auth/roles.guard.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import type { ExecutionContext } from '@nestjs/common';
import type { UserRole } from '@pacific/shared';

const ctx = (role: UserRole, required: UserRole[]): ExecutionContext => {
  const reflector = new Reflector();
  const base = { switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }), getHandler: () => ({}), getClass: () => ({}) } as unknown as ExecutionContext;
  (reflector as unknown as { get: () => UserRole[] }).get = () => required;
  return Object.assign(base, { __reflector: reflector }) as ExecutionContext;
};

describe('RolesGuard', () => {
  it('permite quando o papel está na lista', () => {
    const c = ctx('CREDITOR', ['CREDITOR']);
    const guard = new RolesGuard((c as unknown as { __reflector: Reflector }).__reflector);
    expect(guard.canActivate(c)).toBe(true);
  });
  it('bloqueia quando o papel não está na lista', () => {
    const c = ctx('DEBTOR', ['CREDITOR']);
    const guard = new RolesGuard((c as unknown as { __reflector: Reflector }).__reflector);
    expect(() => guard.canActivate(c)).toThrow();
  });
});
```

- [ ] **Step 7: Rodar (deve falhar)** — Run: `npm test -w @pacific/api` → Expected: FAIL.

- [ ] **Step 8: Implementar `src/auth/roles.guard.ts`**

```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@pacific/shared';
import { ROLES_KEY } from './roles.decorator.js';
import type { RequestWithUser } from './auth.types.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.get<UserRole[]>(ROLES_KEY, context.getHandler()) ?? [];
    if (required.length === 0) return true;
    const user = context.switchToHttp().getRequest<RequestWithUser>().user;
    if (!user || !required.includes(user.role)) throw new ForbiddenException('Papel não autorizado');
    return true;
  }
}
```

- [ ] **Step 9: `src/auth/current-user.decorator.ts`**

```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestWithUser } from './auth.types.js';
export const CurrentUser = createParamDecorator((_d: unknown, ctx: ExecutionContext) =>
  ctx.switchToHttp().getRequest<RequestWithUser>().user);
```

- [ ] **Step 10: Rodar e passar** — Run: `npm test -w @pacific/api` → Expected: PASS.

- [ ] **Step 11: Commit** — `git add packages/api/src/auth && git commit -m "feat(auth): jwt de 3 papeis e roles guard com testes"`

---

### Task 7: Tenancy — contexto, guard e camada tenant-scoped (TDD)

**Files:** Create `src/tenancy/{tenant-context.ts,tenant.guard.ts,tenant-datasource.resolver.ts,tenant-scoped.service.ts}`; Test: `src/tenancy/tenant-context.test.ts`, `src/tenancy/tenant.guard.test.ts`

- [ ] **Step 1: Teste que falha — `src/tenancy/tenant-context.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { resolveTenantId } from './tenant-context';
import type { AuthUser } from '@pacific/shared';

const u = (p: Partial<AuthUser>): AuthUser => ({ supabaseId: 's', email: 'e', role: 'CREDITOR', tenantId: 't1', ...p });

describe('resolveTenantId', () => {
  it('credor usa o tenant do token', () => { expect(resolveTenantId(u({}), undefined)).toBe('t1'); });
  it('credor sem tenant é erro', () => { expect(() => resolveTenantId(u({ tenantId: null }), undefined)).toThrow(); });
  it('super-admin usa o header explícito', () => {
    expect(resolveTenantId(u({ role: 'SUPER_ADMIN', tenantId: null }), 'tX')).toBe('tX');
  });
  it('super-admin sem header é erro', () => {
    expect(() => resolveTenantId(u({ role: 'SUPER_ADMIN', tenantId: null }), undefined)).toThrow();
  });
});
```

- [ ] **Step 2: Rodar (deve falhar)** — Run: `npm test -w @pacific/api` → Expected: FAIL.

- [ ] **Step 3: Implementar `src/tenancy/tenant-context.ts`**

```ts
import type { AuthUser } from '@pacific/shared';

/** Resolve o tenant efetivo do request. Super-admin escolhe via header X-Tenant-Id. */
export function resolveTenantId(user: AuthUser | undefined, headerTenantId: string | undefined): string {
  if (!user) throw new Error('Não autenticado');
  if (user.role === 'SUPER_ADMIN') {
    if (!headerTenantId) throw new Error('Super-admin deve informar X-Tenant-Id');
    return headerTenantId;
  }
  if (!user.tenantId) throw new Error('Usuário sem tenant');
  return user.tenantId;
}
```

- [ ] **Step 4: Teste que falha — `src/tenancy/tenant.guard.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { TenantGuard } from './tenant.guard';
import type { ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@pacific/shared';

const ctx = (user: AuthUser | undefined, headers: Record<string, string | undefined> = {}): ExecutionContext => {
  const req = { user, headers } as { user?: AuthUser; headers: Record<string, string | undefined>; tenantId?: string };
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
};

describe('TenantGuard', () => {
  const guard = new TenantGuard();
  it('injeta req.tenantId para credor', () => {
    const c = ctx({ supabaseId: 's', email: 'e', role: 'CREDITOR', tenantId: 't1' });
    expect(guard.canActivate(c)).toBe(true);
    expect((c.switchToHttp().getRequest() as { tenantId?: string }).tenantId).toBe('t1');
  });
  it('bloqueia super-admin sem header', () => {
    expect(() => guard.canActivate(ctx({ supabaseId: 's', email: 'e', role: 'SUPER_ADMIN', tenantId: null }))).toThrow();
  });
});
```

- [ ] **Step 5: Rodar (deve falhar)** — Run: `npm test -w @pacific/api` → Expected: FAIL.

- [ ] **Step 6: Implementar `src/tenancy/tenant.guard.ts`**

```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { RequestWithUser } from '../auth/auth.types.js';
import { resolveTenantId } from './tenant-context.js';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    try { req.tenantId = resolveTenantId(req.user, req.headers['x-tenant-id']); }
    catch (e) { throw new ForbiddenException((e as Error).message); }
    return true;
  }
}
```

- [ ] **Step 7: `src/tenancy/tenant-datasource.resolver.ts`** (ponto único de extração física futura)

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service.js';

/**
 * Hoje devolve o único datasource. No futuro, pode mapear tenants específicos
 * para clients/bancos dedicados sem alterar os serviços que consomem dados.
 */
@Injectable()
export class TenantDatasourceResolver {
  constructor(private readonly prisma: PrismaService) {}
  forTenant(_tenantId: string): PrismaService { return this.prisma; }
}
```

- [ ] **Step 8: `src/tenancy/tenant-scoped.service.ts`** (injeta tenantId nos filtros)

```ts
import { Injectable } from '@nestjs/common';
import { TenantDatasourceResolver } from './tenant-datasource.resolver.js';
import type { PrismaService } from '../common/prisma.service.js';

@Injectable()
export class TenantScopedService {
  constructor(private readonly resolver: TenantDatasourceResolver) {}
  db(tenantId: string): PrismaService { return this.resolver.forTenant(tenantId); }
  /** Garante o filtro de tenant em qualquer where. */
  scope<T extends object>(tenantId: string, where: T): T & { tenantId: string } {
    return { ...where, tenantId };
  }
}
```

- [ ] **Step 9: Rodar e passar** — Run: `npm test -w @pacific/api` → Expected: PASS.

- [ ] **Step 10: Commit** — `git add packages/api/src/tenancy && git commit -m "feat(tenancy): contexto, guard e camada tenant-scoped com resolver de datasource"`

---

### Task 8: Cadastro de credor + geração de orgCode (TDD)

**Files:** Create `src/creditors/{creditors.service.ts,creditors.controller.ts,dto/register-creditor.dto.ts}`; Test: `src/creditors/creditors.service.test.ts`

- [ ] **Step 1: `src/creditors/dto/register-creditor.dto.ts`**

```ts
import { IsEmail, IsString, MinLength } from 'class-validator';
export class RegisterCreditorDto {
  @IsString() @MinLength(2) orgName!: string;
  @IsString() supabaseId!: string;
  @IsEmail() email!: string;
}
```

- [ ] **Step 2: Teste que falha — `src/creditors/creditors.service.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import { CreditorsService } from './creditors.service';

function fakeDb() {
  const tenants: Array<{ id: string; orgCode: string }> = [];
  const users: Array<{ id: string }> = [];
  return {
    tenant: {
      findUnique: vi.fn(async ({ where }: { where: { orgCode: string } }) =>
        tenants.find((t) => t.orgCode === where.orgCode) ?? null),
      create: vi.fn(async ({ data }: { data: { orgCode: string; name: string } }) => {
        const t = { id: `t${tenants.length + 1}`, orgCode: data.orgCode }; tenants.push(t); return t;
      }),
    },
    user: { create: vi.fn(async () => { const u = { id: `u${users.length + 1}` }; users.push(u); return u; }) },
  };
}

describe('CreditorsService.register', () => {
  it('cria tenant com orgCode único e usuário CREDITOR', async () => {
    const db = fakeDb();
    const svc = new CreditorsService({ forTenant: () => db } as never);
    const out = await svc.register({ orgName: 'Carteira X', supabaseId: 'sb1', email: 'c@x.com' });
    expect(out.orgCode).toMatch(/^PAC-/);
    expect(db.tenant.create).toHaveBeenCalledOnce();
    expect(db.user.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ role: 'CREDITOR' }) }));
  });
});
```

- [ ] **Step 3: Rodar (deve falhar)** — Run: `npm test -w @pacific/api` → Expected: FAIL.

- [ ] **Step 4: Implementar `src/creditors/creditors.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { generateUniqueOrgCode } from '@pacific/shared';
import { TenantDatasourceResolver } from '../tenancy/tenant-datasource.resolver.js';
import type { RegisterCreditorDto } from './dto/register-creditor.dto.js';

@Injectable()
export class CreditorsService {
  constructor(private readonly resolver: TenantDatasourceResolver) {}
  async register(dto: RegisterCreditorDto): Promise<{ tenantId: string; orgCode: string }> {
    const db = this.resolver.forTenant('__provisioning__');
    const orgCode = await generateUniqueOrgCode(
      async (code) => (await db.tenant.findUnique({ where: { orgCode: code } })) !== null,
    );
    const tenant = await db.tenant.create({ data: { name: dto.orgName, orgCode } });
    await db.user.create({
      data: { supabaseId: dto.supabaseId, email: dto.email, role: 'CREDITOR', tenantId: tenant.id },
    });
    return { tenantId: tenant.id, orgCode };
  }
}
```

- [ ] **Step 5: `src/creditors/creditors.controller.ts`**

```ts
import { Body, Controller, Post } from '@nestjs/common';
import { CreditorsService } from './creditors.service.js';
import { RegisterCreditorDto } from './dto/register-creditor.dto.js';

@Controller('auth')
export class CreditorsController {
  constructor(private readonly creditors: CreditorsService) {}
  @Post('register-creditor')
  register(@Body() dto: RegisterCreditorDto): Promise<{ tenantId: string; orgCode: string }> {
    return this.creditors.register(dto);
  }
}
```

- [ ] **Step 6: Rodar e passar** — Run: `npm test -w @pacific/api` → Expected: PASS.

- [ ] **Step 7: Commit** — `git add packages/api/src/creditors && git commit -m "feat(creditors): cadastro de credor com geracao de orgCode"`

---

### Task 9: Resgate do orgCode pelo devedor + rate limit (TDD)

**Files:** Create `src/debtors/{redeem.service.ts,debtors.controller.ts,redeem-rate-limit.guard.ts,dto/redeem.dto.ts}`; Test: `src/debtors/redeem.service.test.ts`, `src/debtors/redeem-rate-limit.guard.test.ts`

- [ ] **Step 1: `src/debtors/dto/redeem.dto.ts`**

```ts
import { IsString, Matches } from 'class-validator';
import { ORG_CODE_REGEX } from '@pacific/shared';
export class RedeemDto {
  @IsString() @Matches(ORG_CODE_REGEX, { message: 'Código inválido' }) orgCode!: string;
}
```

- [ ] **Step 2: Teste que falha — `src/debtors/redeem.service.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import { RedeemService } from './redeem.service';
import { NotFoundException } from '@nestjs/common';

function db(tenant: { id: string; status: string } | null) {
  return {
    tenant: { findUnique: vi.fn(async () => tenant) },
    user: { findUnique: vi.fn(async () => null), create: vi.fn(async () => ({ id: 'u1' })) },
    debtor: { findFirst: vi.fn(async () => null), create: vi.fn(async () => ({ id: 'd1' })), update: vi.fn(async () => ({ id: 'd1' })) },
  };
}

describe('RedeemService.redeem', () => {
  const resolver = (database: ReturnType<typeof db>) => ({ forTenant: () => database }) as never;

  it('vincula devedor ao tenant do código', async () => {
    const database = db({ id: 't1', status: 'ACTIVE' });
    const svc = new RedeemService(resolver(database));
    const out = await svc.redeem({ supabaseId: 'sb9', email: 'd@x.com' }, 'PAC-AAAA-BBBB');
    expect(out.tenantId).toBe('t1');
    expect(database.user.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ role: 'DEBTOR', tenantId: 't1' }) }));
  });

  it('código inexistente → erro genérico (não revela)', async () => {
    const svc = new RedeemService(resolver(db(null)));
    await expect(svc.redeem({ supabaseId: 'sb', email: 'd@x.com' }, 'PAC-ZZZZ-ZZZZ')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('resgate idempotente: usuário já vinculado retorna o vínculo', async () => {
    const database = db({ id: 't1', status: 'ACTIVE' });
    database.user.findUnique = vi.fn(async () => ({ id: 'u1', tenantId: 't1', role: 'DEBTOR' }));
    const svc = new RedeemService(resolver(database));
    const out = await svc.redeem({ supabaseId: 'sb9', email: 'd@x.com' }, 'PAC-AAAA-BBBB');
    expect(out.tenantId).toBe('t1');
    expect(database.user.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Rodar (deve falhar)** — Run: `npm test -w @pacific/api` → Expected: FAIL.

- [ ] **Step 4: Implementar `src/debtors/redeem.service.ts`**

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantDatasourceResolver } from '../tenancy/tenant-datasource.resolver.js';

interface Identity { supabaseId: string; email: string; }

@Injectable()
export class RedeemService {
  constructor(private readonly resolver: TenantDatasourceResolver) {}

  async redeem(identity: Identity, orgCode: string): Promise<{ tenantId: string }> {
    const db = this.resolver.forTenant('__redeem__');

    // Idempotência: usuário já vinculado.
    const existing = await db.user.findUnique({ where: { supabaseId: identity.supabaseId } });
    if (existing?.tenantId) return { tenantId: existing.tenantId };

    // Erro genérico para código inválido ou tenant inativo (não revela qual).
    const tenant = await db.tenant.findUnique({ where: { orgCode } });
    if (!tenant || tenant.status !== 'ACTIVE') throw new NotFoundException('Código inválido');

    const user = await db.user.create({
      data: { supabaseId: identity.supabaseId, email: identity.email, role: 'DEBTOR', tenantId: tenant.id },
    });

    // Fluxo oficial simplificado: resgate baseado APENAS no org_code (sem pré-cadastro,
    // sem associação manual, sem casar por e-mail). Sempre cria o devedor no tenant.
    await db.debtor.create({
      data: { tenantId: tenant.id, userId: user.id, name: identity.email, email: identity.email, redeemedAt: new Date() },
    });
    return { tenantId: tenant.id };
  }
}
```

- [ ] **Step 5: Teste que falha — `src/debtors/redeem-rate-limit.guard.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { RedeemRateLimitGuard } from './redeem-rate-limit.guard';
import type { ExecutionContext } from '@nestjs/common';

const ctx = (ip: string): ExecutionContext =>
  ({ switchToHttp: () => ({ getRequest: () => ({ ip, headers: {} }) }) }) as unknown as ExecutionContext;

describe('RedeemRateLimitGuard', () => {
  it('bloqueia após exceder o limite na janela', () => {
    const guard = new RedeemRateLimitGuard(3, 60_000);
    expect(guard.canActivate(ctx('1.1.1.1'))).toBe(true);
    expect(guard.canActivate(ctx('1.1.1.1'))).toBe(true);
    expect(guard.canActivate(ctx('1.1.1.1'))).toBe(true);
    expect(() => guard.canActivate(ctx('1.1.1.1'))).toThrow();
  });
  it('chaves diferentes não interferem', () => {
    const guard = new RedeemRateLimitGuard(1, 60_000);
    expect(guard.canActivate(ctx('a'))).toBe(true);
    expect(guard.canActivate(ctx('b'))).toBe(true);
  });
});
```

- [ ] **Step 6: Rodar (deve falhar)** — Run: `npm test -w @pacific/api` → Expected: FAIL.

- [ ] **Step 7: Implementar `src/debtors/redeem-rate-limit.guard.ts`**

```ts
import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';

interface Bucket { count: number; resetAt: number; }

@Injectable()
export class RedeemRateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, Bucket>();
  constructor(
    private readonly limit = Number(process.env.REDEEM_RATE_LIMIT ?? 10),
    private readonly windowMs = Number(process.env.REDEEM_RATE_WINDOW_MS ?? 600_000),
  ) {}
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ ip?: string }>();
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const b = this.hits.get(key);
    if (!b || b.resetAt < now) { this.hits.set(key, { count: 1, resetAt: now + this.windowMs }); return true; }
    if (b.count >= this.limit) throw new HttpException('Muitas tentativas', HttpStatus.TOO_MANY_REQUESTS);
    b.count++;
    return true;
  }
}
```

- [ ] **Step 8: `src/debtors/debtors.controller.ts`**

```ts
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { RedeemRateLimitGuard } from './redeem-rate-limit.guard.js';
import { RedeemService } from './redeem.service.js';
import { RedeemDto } from './dto/redeem.dto.js';
import type { AuthUser } from '@pacific/shared';

@Controller('auth')
export class DebtorsController {
  constructor(private readonly redeem: RedeemService) {}
  @Post('redeem')
  @UseGuards(JwtGuard, RedeemRateLimitGuard)
  do(@CurrentUser() user: AuthUser, @Body() dto: RedeemDto): Promise<{ tenantId: string }> {
    return this.redeem.redeem({ supabaseId: user.supabaseId, email: user.email }, dto.orgCode);
  }
}
```

- [ ] **Step 9: Registrar módulos no `app.module.ts`** — adicionar `CreditorsService/Controller`, `RedeemService`, `DebtorsController`, `TenantDatasourceResolver`, `TenantScopedService`, `RolesGuard` providers e `controllers: [CreditorsController, DebtorsController]`.

```ts
import { Module } from '@nestjs/common';
import { PrismaService } from './common/prisma.service.js';
import { TenantDatasourceResolver } from './tenancy/tenant-datasource.resolver.js';
import { TenantScopedService } from './tenancy/tenant-scoped.service.js';
import { CreditorsService } from './creditors/creditors.service.js';
import { CreditorsController } from './creditors/creditors.controller.js';
import { RedeemService } from './debtors/redeem.service.js';
import { DebtorsController } from './debtors/debtors.controller.js';

@Module({
  controllers: [CreditorsController, DebtorsController],
  providers: [PrismaService, TenantDatasourceResolver, TenantScopedService, CreditorsService, RedeemService],
  exports: [PrismaService],
})
export class AppModule {}
```

- [ ] **Step 10: Rodar e passar + build** — Run: `npm test -w @pacific/api && npm run build -w @pacific/api` → Expected: PASS + build ok.

- [ ] **Step 11: Commit** — `git add packages/api/src && git commit -m "feat(debtors): resgate de orgCode com auto-vinculo, idempotencia e rate limit"`

---

### Task 10: Row-Level Security (defesa em profundidade)

**Files:** Create `packages/database/src/rls.sql`

- [ ] **Step 1: `packages/database/src/rls.sql`**

```sql
-- Isolamento por tenant via app.current_tenant (SET LOCAL por request na conexão da API).
ALTER TABLE "Debtor" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_debtor ON "Debtor"
  USING ("tenantId" = current_setting('app.current_tenant', true));
```

- [ ] **Step 2: Aplicar** — Run: `psql "$DATABASE_URL" -f packages/database/src/rls.sql` → Expected: `ALTER TABLE` / `CREATE POLICY` (ou aplicar via SQL editor do Supabase).

- [ ] **Step 3: Commit** — `git add packages/database/src/rls.sql && git commit -m "feat(database): RLS de isolamento por tenant"`

---

### Task 11: Seed, README e verificação final

**Files:** Create `packages/database/seed.ts`, `README.md`

- [ ] **Step 1: `packages/database/seed.ts`**

```ts
import { PrismaClient } from '@prisma/client';
import { generateOrgCode } from '@pacific/shared';
const prisma = new PrismaClient();

async function main(): Promise<void> {
  await prisma.user.create({ data: { supabaseId: 'seed-superadmin', email: 'admin@pacific.app', role: 'SUPER_ADMIN' } });

  const orgCode = generateOrgCode();
  const tenant = await prisma.tenant.create({ data: { name: 'Carteira Demo', orgCode } });
  await prisma.user.create({ data: { supabaseId: 'seed-creditor', email: 'credor@demo.app', role: 'CREDITOR', tenantId: tenant.id } });

  await prisma.debtor.create({ data: { tenantId: tenant.id, name: 'Ana Souza', email: 'ana@demo.app' } });
  await prisma.debtor.create({ data: { tenantId: tenant.id, name: 'Bruno Lima', email: 'bruno@demo.app' } });

  console.log(`Seed ok. orgCode da carteira demo: ${orgCode}`);
}
main().finally(() => void prisma.$disconnect());
```

- [ ] **Step 2: Rodar seed** — Run: `npm run db:seed -w @pacific/database` → Expected: imprime `Seed ok. orgCode da carteira demo: PAC-...`.

- [ ] **Step 3: `README.md`** com: visão, stack, pré-requisitos (Node 20+, Docker, Supabase), passos `npm install` → `cp .env.example packages/database/.env` → `docker compose up -d` → `npm run db:migrate` → aplicar `rls.sql` → `npm run db:seed`, e nota de que a localização é **simulada** (link ao spec) e o onboarding usa `orgCode`.

- [ ] **Step 4: Verificação consolidada** — Run: `npm install && npm run lint && npm test` → Expected: lint sem erro de tipo; testes de `@pacific/shared` e `@pacific/api` passam.

- [ ] **Step 5: Commit** — `git add packages/database/seed.ts README.md && git commit -m "feat: seed multi-tenant, README e verificacao da fase 1"`

---

## Self-Review

**1. Cobertura do escopo (Fase 1):** monorepo (T1) ✓ · tipos/utils/orgCode (T2) ✓ · modelo base 3 níveis com `tenantId`+índices (T3) ✓ · docker/env/migração (T4) ✓ · NestJS+validação+erro+paginação (T5) ✓ · auth 3 papéis + RolesGuard (T6) ✓ · tenancy guard + tenant-scoped + datasource resolver p/ extração futura (T7) ✓ · cadastro de credor + geração de orgCode (T8) ✓ · resgate com auto-vínculo + idempotência + erro genérico + rate limit (T9) ✓ · RLS (T10) ✓ · seed + README + verificação (T11) ✓.

**2. Mitigações de segurança:** alta entropia (T2) · erro genérico no resgate (T9) · rate limit (T9) · idempotência/1 vínculo (T9, `userId @unique`) · isolamento por `tenantId` (T3/T7/T10). Rotação de `orgCode` fica como endpoint da Fase 2 (não bloqueia a validação do onboarding).

**3. Consistência de tipos:** `AuthUser`/`UserRole` vêm de `@pacific/shared` e são reusados em auth/tenancy/controllers; `ORG_CODE_REGEX` definido em T2 e reusado no `RedeemDto` (T9); `TenantDatasourceResolver.forTenant` usado igualmente em T7/T8/T9; `app.current_tenant` (T10) coerente com a camada tenant-scoped.

import { describe, it, expect } from 'vitest';
import { RolesGuard } from './roles.guard.js';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { UserRole } from '@pacific/shared';

const makeCtx = (role: UserRole): ExecutionContext => ({
  switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  getHandler: () => () => {},
  getClass: () => class {},
}) as unknown as ExecutionContext;

const makeReflector = (required: UserRole[]): Reflector => ({ get: () => required }) as unknown as Reflector;

describe('RolesGuard', () => {
  it('permite quando o papel está na lista', () => {
    expect(new RolesGuard(makeReflector(['CREDITOR'])).canActivate(makeCtx('CREDITOR'))).toBe(true);
  });
  it('bloqueia quando o papel não está na lista', () => {
    expect(() => new RolesGuard(makeReflector(['CREDITOR'])).canActivate(makeCtx('DEBTOR'))).toThrow();
  });
  it('permite quando nenhuma role é exigida', () => {
    expect(new RolesGuard(makeReflector([])).canActivate(makeCtx('DEBTOR'))).toBe(true);
  });
});

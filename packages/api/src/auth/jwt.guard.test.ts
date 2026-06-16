import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { JwtGuard } from './jwt.guard.js';
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

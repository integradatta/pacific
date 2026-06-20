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
  it('rejeita sem token', async () => { await expect(guard.canActivate(ctx({}))).rejects.toThrow(); });
  it('aceita token de credor e popula user', async () => {
    const t = jwt.sign({ sub: 'sb1', email: 'c@x.com', app_metadata: { role: 'CREDITOR', tenantId: 't1' } }, SECRET);
    const c = ctx({ authorization: `Bearer ${t}` });
    expect(await guard.canActivate(c)).toBe(true);
    expect((c.switchToHttp().getRequest() as { user?: { role: string } }).user?.role).toBe('CREDITOR');
  });
  it('super-admin tem tenantId null', async () => {
    const t = jwt.sign({ sub: 'sb0', email: 'a@x.com', app_metadata: { role: 'SUPER_ADMIN' } }, SECRET);
    const c = ctx({ authorization: `Bearer ${t}` });
    await guard.canActivate(c);
    expect((c.switchToHttp().getRequest() as { user?: { tenantId: string | null } }).user?.tenantId).toBeNull();
  });
  it('rejeita segredo errado', async () => {
    const t = jwt.sign({ sub: 'x' }, 'outro');
    await expect(guard.canActivate(ctx({ authorization: `Bearer ${t}` }))).rejects.toThrow();
  });
  it('aceita token de devedor (role DEBTOR) e popula debtorId', async () => {
    const t = jwt.sign({ sub: 'deb1', app_metadata: { role: 'DEBTOR', tenantId: 't1', debtorId: 'deb1' } }, SECRET);
    const c = ctx({ authorization: `Bearer ${t}` });
    expect(await guard.canActivate(c)).toBe(true);
    const u = (c.switchToHttp().getRequest() as { user?: { role: string; debtorId?: string; tenantId: string | null } }).user;
    expect(u?.role).toBe('DEBTOR');
    expect(u?.debtorId).toBe('deb1');
    expect(u?.tenantId).toBe('t1');
  });
});

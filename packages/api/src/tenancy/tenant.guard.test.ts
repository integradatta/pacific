import { describe, it, expect } from 'vitest';
import { TenantGuard } from './tenant.guard.js';
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

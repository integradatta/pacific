import { describe, it, expect, vi } from 'vitest';
import { PrincipalGuard } from './principal.guard.js';
import type { ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@pacific/shared';

const ctx = (user: AuthUser): ExecutionContext => {
  const req = { user };
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
};
const scoped = (row: { role: string; tenantId: string | null } | null) =>
  ({ raw: () => ({ user: { findUnique: vi.fn(async () => row) } }) }) as never;

describe('PrincipalGuard', () => {
  it('resolve role+tenantId do banco para usuário Supabase sem tenant', async () => {
    const user: AuthUser = { supabaseId: 'sb1', email: 'c@x.com', role: 'CREDITOR', tenantId: null };
    await new PrincipalGuard(scoped({ role: 'CREDITOR', tenantId: 't1' })).canActivate(ctx(user));
    expect(user.tenantId).toBe('t1');
    expect(user.role).toBe('CREDITOR');
  });

  it('resolve super-admin (role do banco, sem tenant)', async () => {
    const user: AuthUser = { supabaseId: 'sb0', email: 'a@x.com', role: 'CREDITOR', tenantId: null };
    await new PrincipalGuard(scoped({ role: 'SUPER_ADMIN', tenantId: null })).canActivate(ctx(user));
    expect(user.role).toBe('SUPER_ADMIN');
    expect(user.tenantId).toBeNull();
  });

  it('não consulta o banco para devedor (já tem tenant do token)', async () => {
    const raw = { user: { findUnique: vi.fn() } };
    const user: AuthUser = { supabaseId: 'd', email: '', role: 'DEBTOR', tenantId: 't1', debtorId: 'd1' };
    await new PrincipalGuard({ raw: () => raw } as never).canActivate(ctx(user));
    expect(raw.user.findUnique).not.toHaveBeenCalled();
  });

  it('usuário Supabase sem registro segue sem tenant', async () => {
    const user: AuthUser = { supabaseId: 'novo', email: 'n@x.com', role: 'CREDITOR', tenantId: null };
    await new PrincipalGuard(scoped(null)).canActivate(ctx(user));
    expect(user.tenantId).toBeNull();
  });
});

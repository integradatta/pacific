import { describe, it, expect, vi } from 'vitest';
import { DebtorGuard } from './debtor.guard.js';
import type { ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@pacific/shared';

const ctx = (user: AuthUser | undefined, tenantId?: string): ExecutionContext => {
  const req = { user, tenantId };
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
};

// scoped fake: raw().debtorAccess.findUnique (global) + withTenant → debtor.findUnique (tenant-scoped).
function scoped(opts: {
  access?: { active: boolean; rotatedAt: Date | null } | null;
  debtorExists?: boolean;
  rawThrows?: boolean;
}) {
  return {
    raw: () => ({
      debtorAccess: {
        findUnique: vi.fn(async () => {
          if (opts.rawThrows) throw new Error('db down');
          return opts.access ?? null;
        }),
      },
    }),
    withTenant: async (_t: string, fn: (tx: { debtor: { findUnique: () => Promise<{ id: string } | null> } }) => unknown) =>
      fn({ debtor: { findUnique: async () => (opts.debtorExists === false ? null : { id: 'd1' }) } }),
  } as never;
}

const debtor = (accessVersion = 0): AuthUser => ({ supabaseId: 'd1', email: '', role: 'DEBTOR', tenantId: 't1', debtorId: 'd1', accessVersion });

describe('DebtorGuard', () => {
  it('passa quando ativo, versão bate e devedor existe', async () => {
    const g = new DebtorGuard(scoped({ access: { active: true, rotatedAt: null }, debtorExists: true }));
    await expect(g.canActivate(ctx(debtor(0), 't1'))).resolves.toBe(true);
  });

  it('ignora não-devedores', async () => {
    const g = new DebtorGuard(scoped({}));
    const creditor: AuthUser = { supabaseId: 'c', email: '', role: 'CREDITOR', tenantId: 't1' };
    await expect(g.canActivate(ctx(creditor, 't1'))).resolves.toBe(true);
  });

  it('acesso desativado → 401', async () => {
    const g = new DebtorGuard(scoped({ access: { active: false, rotatedAt: null } }));
    await expect(g.canActivate(ctx(debtor(0), 't1'))).rejects.toThrow(/revogado/i);
  });

  it('versão do link não confere (rotacionado) → 401', async () => {
    const rotatedAt = new Date('2026-01-01T00:00:00Z');
    const g = new DebtorGuard(scoped({ access: { active: true, rotatedAt }, debtorExists: true }));
    await expect(g.canActivate(ctx(debtor(0), 't1'))).rejects.toThrow(/atualizado/i);
  });

  it('devedor sumiu → 401 convite expirado', async () => {
    const g = new DebtorGuard(scoped({ access: { active: true, rotatedAt: null }, debtorExists: false }));
    await expect(g.canActivate(ctx(debtor(0), 't1'))).rejects.toThrow(/expirado/i);
  });

  it('erro transitório de banco → não desloga (fail-open)', async () => {
    const g = new DebtorGuard(scoped({ rawThrows: true }));
    await expect(g.canActivate(ctx(debtor(0), 't1'))).resolves.toBe(true);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { CreditorsService } from './creditors.service.js';

function fakeDb() {
  const tenants: Array<{ id: string; name: string; orgCode: string }> = [];
  const users: Array<{ id: string; supabaseId: string; tenantId: string }> = [];
  const db = {
    tenant: {
      findUnique: vi.fn(async ({ where }: { where: { orgCode?: string; id?: string } }) =>
        tenants.find((t) => (where.orgCode !== undefined ? t.orgCode === where.orgCode : t.id === where.id)) ?? null),
      create: vi.fn(async ({ data }: { data: { orgCode: string; name: string } }) => {
        const t = { id: `t${tenants.length + 1}`, name: data.name, orgCode: data.orgCode };
        tenants.push(t);
        return t;
      }),
    },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { supabaseId: string } }) =>
        users.find((u) => u.supabaseId === where.supabaseId) ?? null),
      create: vi.fn(async ({ data }: { data: { supabaseId: string; tenantId: string } }) => {
        const u = { id: `u${users.length + 1}`, supabaseId: data.supabaseId, tenantId: data.tenantId };
        users.push(u);
        return u;
      }),
      update: vi.fn(async ({ where, data }: { where: { supabaseId: string }; data: Record<string, unknown> }) => {
        const u = users.find((x) => x.supabaseId === where.supabaseId);
        if (u) Object.assign(u, data);
        return u;
      }),
    },
  };
  // $transaction interativo: executa o callback com o próprio db (mesmos mocks).
  return Object.assign(db, { $transaction: async (fn: (tx: typeof db) => unknown) => fn(db) });
}

describe('CreditorsService.register', () => {
  it('cria tenant com orgCode único e usuário CREDITOR (transacional)', async () => {
    const db = fakeDb();
    const svc = new CreditorsService({ forTenant: () => db } as never);
    const out = await svc.register({ orgName: 'Carteira X', supabaseId: 'sb1', email: 'c@x.com' });
    expect(out.orgCode).toMatch(/^PAC-/);
    expect(db.tenant.create).toHaveBeenCalledOnce();
    expect(db.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'CREDITOR' }) }),
    );
  });

  it('idempotente: re-chamar com o mesmo supabaseId devolve a MESMA carteira sem recriar', async () => {
    const db = fakeDb();
    const svc = new CreditorsService({ forTenant: () => db } as never);
    const first = await svc.register({ orgName: 'Carteira X', supabaseId: 'sb1', email: 'c@x.com' });
    const second = await svc.register({ orgName: 'Outro Nome', supabaseId: 'sb1', email: 'c@x.com' });
    expect(second.tenantId).toBe(first.tenantId);
    expect(second.orgCode).toBe(first.orgCode);
    expect(db.tenant.create).toHaveBeenCalledOnce(); // não recria
    expect(db.user.create).toHaveBeenCalledOnce();
  });

  it('corrida (P2002) sem registro existente → ConflictException', async () => {
    const db = fakeDb();
    db.user.create = vi.fn(async () => {
      throw Object.assign(new Error('unique violation'), { code: 'P2002' });
    });
    const svc = new CreditorsService({ forTenant: () => db } as never);
    await expect(svc.register({ orgName: 'X', supabaseId: 'sb1', email: 'c@x.com' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('CreditorsService — aceite de termos', () => {
  it('hasAcceptedTerms é false antes e true depois de acceptTerms', async () => {
    const db = fakeDb();
    await db.user.create({ data: { supabaseId: 'sb1', tenantId: 't1' } });
    const svc = new CreditorsService({ forTenant: () => db } as never);
    expect(await svc.hasAcceptedTerms('sb1')).toBe(false);
    await svc.acceptTerms('sb1', 'v1');
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { supabaseId: 'sb1' }, data: expect.objectContaining({ termsVersion: 'v1', termsAcceptedAt: expect.any(Date) }) }),
    );
    expect(await svc.hasAcceptedTerms('sb1')).toBe(true);
  });
});

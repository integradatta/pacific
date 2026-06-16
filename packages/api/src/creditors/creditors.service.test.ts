import { describe, it, expect, vi } from 'vitest';
import { CreditorsService } from './creditors.service.js';

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

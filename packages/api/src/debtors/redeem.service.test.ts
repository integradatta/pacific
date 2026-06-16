import { describe, it, expect, vi } from 'vitest';
import { RedeemService } from './redeem.service.js';
import { NotFoundException } from '@nestjs/common';

function db(tenant: { id: string; status: string } | null) {
  return {
    tenant: { findUnique: vi.fn(async () => tenant) },
    user: { findUnique: vi.fn<() => Promise<{ id: string; tenantId: string; role: string } | null>>(async () => null), create: vi.fn(async () => ({ id: 'u1' })) },
    debtor: { create: vi.fn(async () => ({ id: 'd1' })) },
  };
}
const resolver = (database: ReturnType<typeof db>) => ({ forTenant: () => database }) as never;

describe('RedeemService.redeem', () => {
  it('vincula devedor ao tenant do código', async () => {
    const database = db({ id: 't1', status: 'ACTIVE' });
    const out = await new RedeemService(resolver(database)).redeem({ supabaseId: 'sb9', email: 'd@x.com' }, 'PAC-AAAA-BBBB');
    expect(out.tenantId).toBe('t1');
    expect(database.user.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ role: 'DEBTOR', tenantId: 't1' }) }));
    expect(database.debtor.create).toHaveBeenCalledOnce();
  });
  it('código inexistente → NotFound genérico', async () => {
    await expect(new RedeemService(resolver(db(null))).redeem({ supabaseId: 'sb', email: 'd@x.com' }, 'PAC-ZZZZ-ZZZZ'))
      .rejects.toBeInstanceOf(NotFoundException);
  });
  it('tenant suspenso → NotFound genérico (não revela)', async () => {
    await expect(new RedeemService(resolver(db({ id: 't1', status: 'SUSPENDED' }))).redeem({ supabaseId: 'sb', email: 'd@x.com' }, 'PAC-AAAA-BBBB'))
      .rejects.toBeInstanceOf(NotFoundException);
  });
  it('idempotente: usuário já vinculado retorna o vínculo sem recriar', async () => {
    const database = db({ id: 't1', status: 'ACTIVE' });
    database.user.findUnique = vi.fn(async () => ({ id: 'u1', tenantId: 't1', role: 'DEBTOR' }));
    const out = await new RedeemService(resolver(database)).redeem({ supabaseId: 'sb9', email: 'd@x.com' }, 'PAC-AAAA-BBBB');
    expect(out.tenantId).toBe('t1');
    expect(database.user.create).not.toHaveBeenCalled();
    expect(database.debtor.create).not.toHaveBeenCalled();
  });
});

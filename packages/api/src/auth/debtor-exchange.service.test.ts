import { describe, it, expect, vi } from 'vitest';
import { DebtorExchangeService } from './debtor-exchange.service.js';
import { UnauthorizedException } from '@nestjs/common';

function deps(access: { debtorId: string; tenantId: string; active: boolean } | null) {
  const tx = {
    debtorAccess: { updateMany: vi.fn(async () => ({ count: 1 })) },
    debtorLoginEvent: { create: vi.fn(async () => ({ id: 'e1' })) },
  };
  const scoped = {
    raw: () => ({ debtorAccess: { findUnique: vi.fn(async () => access) } }),
    withTenant: async (_t: string, fn: (t: typeof tx) => unknown) => fn(tx),
  };
  const tokens = { sign: vi.fn(() => 'jwt-xyz') };
  return { svc: new DebtorExchangeService(scoped as never, tokens as never), tx, tokens };
}

describe('DebtorExchangeService.exchange', () => {
  it('token válido → emite JWT, marca lastSeenAt e registra login', async () => {
    const { svc, tx, tokens } = deps({ debtorId: 'd1', tenantId: 't1', active: true });
    const out = await svc.exchange('rawtoken', '1.2.3.4');
    expect(out.token).toBe('jwt-xyz');
    expect(tokens.sign).toHaveBeenCalledWith({ debtorId: 'd1', tenantId: 't1' });
    expect(tx.debtorLoginEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ debtorId: 'd1', tenantId: 't1', success: true }) }));
    expect(tx.debtorAccess.updateMany).toHaveBeenCalled();
  });
  it('token desconhecido → Unauthorized genérico', async () => {
    const { svc } = deps(null);
    await expect(svc.exchange('x')).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('acesso revogado → Unauthorized genérico', async () => {
    const { svc } = deps({ debtorId: 'd1', tenantId: 't1', active: false });
    await expect(svc.exchange('x')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

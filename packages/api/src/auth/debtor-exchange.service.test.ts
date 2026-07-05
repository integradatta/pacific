import { describe, it, expect, vi } from 'vitest';
import { DebtorExchangeService } from './debtor-exchange.service.js';
import { TrackingService } from '../tracking/tracking.service.js';
import { UnauthorizedException } from '@nestjs/common';

function deps(
  access: { id?: string; debtorId: string; tenantId: string; active: boolean; rotatedAt?: Date } | null,
  tenant: { status: string; approval: string } | null = { status: 'ACTIVE', approval: 'APPROVED' },
) {
  const tx = {
    debtorAccess: { updateMany: vi.fn(async () => ({ count: 1 })) },
    debtorLoginEvent: { create: vi.fn(async () => ({ id: 'e1' })), count: vi.fn(async () => 0) },
    debtor: { findUnique: vi.fn(async () => ({ name: 'Sobrinho' })) },
    notification: { create: vi.fn(async () => ({})) },
    platformEvent: { create: vi.fn(async () => ({})) },
  };
  const scoped = {
    raw: () => ({
      debtorAccess: { findUnique: vi.fn(async () => access) },
      tenant: { findUnique: vi.fn(async () => tenant) },
    }),
    withTenant: async (_t: string, fn: (t: typeof tx) => unknown) => fn(tx),
  };
  const tokens = { sign: vi.fn(() => 'jwt-xyz') };
  const tracking = new TrackingService(scoped as never);
  const push = { notifyImportant: vi.fn(async () => 0) };
  return { svc: new DebtorExchangeService(scoped as never, tokens as never, tracking, push as never), tx, tokens, push };
}

describe('DebtorExchangeService.exchange', () => {
  it('token válido → emite JWT, marca lastSeenAt e registra login', async () => {
    const { svc, tx, tokens } = deps({ debtorId: 'd1', tenantId: 't1', active: true });
    const out = await svc.exchange('rawtoken', '1.2.3.4');
    expect(out.token).toBe('jwt-xyz');
    expect(tokens.sign).toHaveBeenCalledWith({ debtorId: 'd1', tenantId: 't1', accessVersion: 0 });
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
  it('tenant suspenso → Unauthorized (não emite sessão)', async () => {
    const { svc, tokens } = deps({ debtorId: 'd1', tenantId: 't1', active: true }, { status: 'SUSPENDED', approval: 'APPROVED' });
    await expect(svc.exchange('rawtoken')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tokens.sign).not.toHaveBeenCalled();
  });
  it('link rotacionado → assina com accessVersion = rotatedAt', async () => {
    const rotatedAt = new Date('2026-01-01T00:00:00Z');
    const { svc, tokens } = deps({ debtorId: 'd1', tenantId: 't1', active: true, rotatedAt });
    await svc.exchange('rawtoken');
    expect(tokens.sign).toHaveBeenCalledWith({ debtorId: 'd1', tenantId: 't1', accessVersion: rotatedAt.getTime() });
  });
});

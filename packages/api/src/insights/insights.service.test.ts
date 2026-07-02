import { describe, it, expect, vi } from 'vitest';
import { InsightsService } from './insights.service.js';

// Fake tx: dados controlados. 1 dívida aberta (vence longe → não é overdue/due), login recente
// (→ não esfriando), 1 pagamento avisado e 1 pedido de suporte. Espera: [support, claim].
function fakeTx() {
  const now = new Date();
  const farDue = new Date(now.getTime() + 60 * 86_400_000);
  return {
    debt: {
      findMany: vi.fn(async () => [
        { id: 'debt1', debtorId: 'd1', principal: '1000', rate: '0.05', ratePeriod: 'MONTHLY', startDate: now, dueDate: farDue, paidAmount: '0', settledAt: null, debtor: { id: 'd1', name: 'João Silva' } },
      ]),
    },
    debtorLoginEvent: { findMany: vi.fn(async () => [{ debtorId: 'd1', at: new Date(now.getTime() - 2 * 86_400_000) }]) },
    locationConsent: { findMany: vi.fn(async () => []) },
    debtorPosition: { findMany: vi.fn(async () => []) },
    paymentClaim: { findMany: vi.fn(async () => [{ debtId: 'debt1', debtorId: 'd1', amount: '100' }]) },
    debtorSignal: { findMany: vi.fn(async () => [{ id: 's1', debtorId: 'd1', debtId: 'debt1', kind: 'NEED_SUPPORT', dueDate: null, note: null, createdAt: now }]) },
    debtor: { findMany: vi.fn(async () => [{ id: 'd1', name: 'João Silva' }]) },
  };
}

const svc = (tx: ReturnType<typeof fakeTx>) =>
  new InsightsService(
    { withTenant: async (_t: string, fn: (t: typeof tx) => unknown) => fn(tx) } as never,
    {} as never, // dashboard não é usado por suggestions()
  );

describe('InsightsService.suggestions', () => {
  it('compõe suporte + pagamento avisado, ordenados por prioridade', async () => {
    const out = await svc(fakeTx()).suggestions('t1');
    expect(out.map((s) => s.kind)).toEqual(['support', 'claim']);
    expect(out[0]!.title).toMatch(/João/);
    expect(out[0]!.href).toBe('/operacoes/debt1');
    // dívida vence longe → não gera overdue/due_soon
    expect(out.some((s) => s.kind === 'overdue' || s.kind === 'due_soon')).toBe(false);
  });
});

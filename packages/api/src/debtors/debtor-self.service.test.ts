import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DebtorSelfService } from './debtor-self.service.js';

const start = new Date('2026-01-01T00:00:00Z');
const dec = (v: string) => ({ toString: () => v, toFixed: () => Number(v).toFixed(2) });
function fakeDb(debts: Array<{ id: string; settledAt?: Date | null }>, payEvents: Array<{ targetId: string; at: Date; detail: unknown }> = []) {
  return {
    debt: {
      findMany: vi.fn(async () =>
        debts.map((d) => ({
          id: d.id, debtorId: 'me', tenantId: 't1',
          principal: dec('1000.00'), rate: dec('0'), ratePeriod: 'MONTHLY',
          startDate: start, dueDate: new Date('2026-06-01T00:00:00Z'),
          paidAmount: dec('0'), settledAt: null,
        })),
      ),
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) => {
        const d = debts.find((x) => x.id === where.id);
        return d ? { id: d.id, tenantId: 't1', debtorId: 'me', settledAt: d.settledAt ?? null } : null;
      }),
    },
    platformEvent: { findMany: vi.fn(async () => payEvents), create: vi.fn(async () => ({})) },
    paymentClaim: { findMany: vi.fn(async () => []), findFirst: vi.fn(async () => null), create: vi.fn(async () => ({})) },
    deviceToken: { upsert: vi.fn(async () => ({})), deleteMany: vi.fn(async () => ({ count: 0 })) },
    debtor: { findUnique: vi.fn(async () => ({ name: 'Sobrinho' })) },
    notification: { upsert: vi.fn(async () => ({})), create: vi.fn(async () => ({})) },
  };
}
const tracking = { record: vi.fn(async () => undefined) };
const svc = (db: ReturnType<typeof fakeDb>) =>
  new DebtorSelfService(
    { withTenant: async (_t: string, fn: (tx: typeof db) => unknown) => fn(db), raw: () => db } as never,
    tracking as never,
  );

describe('DebtorSelfService.myDebts', () => {
  it('retorna as dívidas do próprio devedor com summary + principal, escopado por tenant+debtor', async () => {
    const db = fakeDb([{ id: 'debt1' }]);
    const out = await svc(db).myDebts('t1', 'me');
    expect(db.debt.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 't1', debtorId: 'me', deletedAt: null } }));
    expect(out).toHaveLength(1);
    expect(out[0]!).toMatchObject({ id: 'debt1', principal: '1000.00' });
    expect(out[0]!.summary.balance).toBe('1000.00');
    expect(out[0]!.payments).toEqual([]);
  });

  it('inclui o histórico de pagamentos (eventos OPERATION_PAID) por dívida', async () => {
    const db = fakeDb([{ id: 'debt1' }], [
      { targetId: 'debt1', at: new Date('2026-03-01T00:00:00Z'), detail: { paidAmount: '300.00' } },
      { targetId: 'debt1', at: new Date('2026-04-01T00:00:00Z'), detail: { paidAmount: '500.00' } },
    ]);
    const out = await svc(db).myDebts('t1', 'me');
    expect(db.platformEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: 'OPERATION_PAID', targetType: 'debt' }) }),
    );
    expect(out[0]!.payments).toEqual([
      { at: '2026-03-01T00:00:00.000Z', total: '300.00' },
      { at: '2026-04-01T00:00:00.000Z', total: '500.00' },
    ]);
  });

  it('registerPushToken faz upsert do token do dispositivo', async () => {
    const db = fakeDb([]);
    await svc(db).registerPushToken('t1', 'me', 'fcm-abc', 'android');
    expect(db.deviceToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { token: 'fcm-abc' }, create: expect.objectContaining({ debtorId: 'me', platform: 'android' }) }),
    );
  });
});

describe('DebtorSelfService.claimPayment', () => {
  it('cria um PaymentClaim PENDING e registra o tracking', async () => {
    const db = fakeDb([{ id: 'debt1' }]);
    await svc(db).claimPayment('t1', 'me', 'debt1', '150.00', '  pix enviado  ');
    expect(db.paymentClaim.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: 't1', debtId: 'debt1', debtorId: 'me', amount: '150.00', note: 'pix enviado' }) }),
    );
    expect(tracking.record).toHaveBeenCalledWith(db, expect.objectContaining({ type: 'PAYMENT_CLAIMED', actorType: 'DEBTOR' }));
  });

  it('recusa dívida de outro devedor/inexistente → NotFound', async () => {
    const db = fakeDb([{ id: 'debt1' }]);
    await expect(svc(db).claimPayment('t1', 'me', 'x', '10.00')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('recusa quando a dívida já está quitada', async () => {
    const db = fakeDb([{ id: 'debt1', settledAt: new Date() }]);
    await expect(svc(db).claimPayment('t1', 'me', 'debt1', '10.00')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa duplicar quando já há um pendente', async () => {
    const db = fakeDb([{ id: 'debt1' }]);
    db.paymentClaim.findFirst = vi.fn(async () => ({ id: 'c1' })) as never;
    await expect(svc(db).claimPayment('t1', 'me', 'debt1', '10.00')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa valor zero/negativo', async () => {
    const db = fakeDb([{ id: 'debt1' }]);
    await expect(svc(db).claimPayment('t1', 'me', 'debt1', '0')).rejects.toBeInstanceOf(BadRequestException);
  });
});

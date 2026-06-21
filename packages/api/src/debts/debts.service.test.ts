import { describe, it, expect, vi } from 'vitest';
import { DebtsService } from './debts.service.js';
import { NotFoundException } from '@nestjs/common';

const dec = (v: string) => ({ toString: () => v });
function debtRow(over: Record<string, unknown> = {}) {
  return {
    id: 'debt1',
    tenantId: 't1',
    debtorId: 'd1',
    description: null,
    tags: [],
    principal: dec('1000.00'),
    rate: dec('0.030000'),
    ratePeriod: 'MONTHLY',
    currency: 'BRL',
    startDate: new Date('2026-05-01T00:00:00Z'),
    dueDate: new Date('2026-07-01T00:00:00Z'),
    status: 'GREEN',
    paidAmount: dec('0'),
    settledAt: null,
    createdAt: new Date('2026-05-01T00:00:00Z'),
    debtor: { name: 'Cliente A' },
    ...over,
  };
}

function fakeDb() {
  return {
    debtor: {
      findFirst: vi.fn(async () => ({ id: 'd1', tenantId: 't1' })),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'dq', ...data })),
    },
    debtorAccess: { create: vi.fn(async () => ({})), findFirst: vi.fn(async () => null) },
    debtorLoginEvent: { findMany: vi.fn(async () => []) },
    notification: { findMany: vi.fn(async () => []), deleteMany: vi.fn(async () => ({ count: 0 })) },
    debt: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'debt1', ...data })),
      update: vi.fn(async () => ({})),
      findMany: vi.fn(async () => [{ id: 'debt1' }]),
      count: vi.fn(async () => 1),
      findFirst: vi.fn(async ({ where }: { where: { id: string; tenantId: string } }) =>
        where.id === 'debt1' && where.tenantId === 't1' ? debtRow() : null),
    },
  };
}
// withTenant executa o callback com o db fake como "tx" (a transação real só roda em runtime).
const svc = (db: ReturnType<typeof fakeDb>) =>
  new DebtsService({ withTenant: async (_t: string, fn: (tx: typeof db) => unknown) => fn(db) } as never);
const base = { principal: '1000.00', rate: '0.030000', ratePeriod: 'MONTHLY' as const, startDate: '2026-05-01T00:00:00Z', dueDate: '2026-07-01T00:00:00Z' };

describe('DebtsService', () => {
  it('create injeta tenantId e valida o devedor do tenant', async () => {
    const db = fakeDb();
    const out = await svc(db).create('t1', { debtorId: 'd1', ...base });
    expect(db.debt.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: 't1', debtorId: 'd1' }) }));
    expect(out.id).toBe('debt1');
  });
  it('create rejeita devedor de outro tenant', async () => {
    const db = fakeDb(); db.debtor.findFirst = vi.fn(async () => null) as never;
    await expect(svc(db).create('t1', { debtorId: 'x', ...base })).rejects.toBeInstanceOf(NotFoundException);
  });
  it('create normaliza tags', async () => {
    const db = fakeDb();
    await svc(db).create('t1', { debtorId: 'd1', ...base, tags: ['  VIP ', 'vip', 'Judicial'] });
    expect(db.debt.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tags: ['vip', 'judicial'] }) }));
  });
  it('list filtra por tenantId e pagina', async () => {
    const db = fakeDb();
    const page = await svc(db).list('t1', { limit: 20, offset: 0 });
    expect(db.debt.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 't1' }, take: 20, skip: 0 }));
    expect(page.total).toBe(1);
  });
  it('get devolve registro com nome do devedor e tags', async () => {
    const db = fakeDb();
    db.debt.findFirst = vi.fn(async () => debtRow({ tags: ['negociando'] })) as never;
    const rec = await svc(db).get('t1', 'debt1');
    expect(rec).toMatchObject({ id: 'debt1', debtorName: 'Cliente A', tags: ['negociando'], principal: '1000.00' });
  });
  it('get de outro tenant → NotFound', async () => {
    await expect(svc(fakeDb()).get('t2', 'debt1')).rejects.toBeInstanceOf(NotFoundException);
  });
  it('setTags normaliza e persiste', async () => {
    const db = fakeDb();
    await svc(db).setTags('t1', 'debt1', ['Atrasado', 'atrasado', '  ']);
    expect(db.debt.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'debt1' }, data: { tags: ['atrasado'] } }));
  });
  it('setTags de outro tenant → NotFound', async () => {
    await expect(svc(fakeDb()).setTags('t2', 'debt1', ['x'])).rejects.toBeInstanceOf(NotFoundException);
  });
  it('createQuick cria cliente + acesso + dívida no mesmo tenant (atômico)', async () => {
    const db = fakeDb();
    const out = await svc(db).createQuick('t1', {
      clientName: 'Cliente A', principal: '1000.00', rate: '0.050000', ratePeriod: 'MONTHLY', dueDate: '2026-07-01T00:00:00Z',
    });
    expect(db.debtor.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: 't1', name: 'Cliente A' }) }));
    expect(db.debtorAccess.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: 't1', debtorId: 'dq' }) }));
    expect(db.debt.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: 't1', debtorId: 'dq', principal: '1000.00' }) }));
    expect(out).toEqual({ debtorId: 'dq', debtId: 'debt1' });
  });

  describe('history (derivado)', () => {
    it('compõe criação + link + acessos + alertas, do mais recente ao mais antigo', async () => {
      const db = fakeDb();
      db.debtorAccess.findFirst = vi.fn(async () => ({
        createdAt: new Date('2026-05-02T00:00:00Z'),
        rotatedAt: new Date('2026-05-10T00:00:00Z'),
      })) as never;
      db.debtorLoginEvent.findMany = vi.fn(async () => [{ at: new Date('2026-05-12T00:00:00Z') }]) as never;
      db.notification.findMany = vi.fn(async () => [
        { createdAt: new Date('2026-05-15T00:00:00Z'), title: 'Vence em 7 dias', body: 'corpo' },
      ]) as never;
      // "agora" antes do vencimento (2026-07-01) → sem evento "venceu"
      const events = await svc(db).history('t1', 'debt1', new Date('2026-06-01T00:00:00Z'));
      expect(events.map((e) => e.kind)).toEqual(['notification', 'login', 'link', 'link', 'created']);
      expect(events[0]).toMatchObject({ kind: 'notification', title: 'Vence em 7 dias', detail: 'corpo' });
      expect(events.at(-1)).toMatchObject({ kind: 'created' });
      // ordenação decrescente por timestamp
      const ts = events.map((e) => e.at);
      expect([...ts].sort((a, b) => (a < b ? 1 : -1))).toEqual(ts);
    });
    it('inclui "Operação venceu" quando já passou do vencimento', async () => {
      const db = fakeDb();
      const events = await svc(db).history('t1', 'debt1', new Date('2026-08-01T00:00:00Z'));
      expect(events.some((e) => e.kind === 'due')).toBe(true);
    });
    it('filtra notificações e acessos por tenant + dívida/devedor', async () => {
      const db = fakeDb();
      await svc(db).history('t1', 'debt1', new Date('2026-06-01T00:00:00Z'));
      expect(db.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 't1', debtId: 'debt1' } }));
      expect(db.debtorLoginEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 't1', debtorId: 'd1', success: true } }),
      );
    });
    it('history de outro tenant → NotFound', async () => {
      await expect(svc(fakeDb()).history('t2', 'debt1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('pay (pagamento)', () => {
    const NOW = new Date('2026-06-01T00:00:00Z');
    const zeroRate = (db: ReturnType<typeof fakeDb>) => {
      db.debt.findFirst = vi.fn(async () => debtRow({ rate: dec('0') })) as never; // gross = principal = 1000.00
    };

    it('total (full) quita: paidAmount = saldo bruto e settledAt setado', async () => {
      const db = fakeDb(); zeroRate(db);
      await svc(db).pay('t1', 'debt1', { full: true }, NOW);
      expect(db.debt.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'debt1' }, data: expect.objectContaining({ paidAmount: '1000.00', settledAt: NOW }) }),
      );
    });
    it('parcial abate sem quitar (settledAt null)', async () => {
      const db = fakeDb(); zeroRate(db);
      await svc(db).pay('t1', 'debt1', { amount: '300' }, NOW);
      expect(db.debt.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { paidAmount: '300.00', settledAt: null } }),
      );
    });
    it('parcial que cobre o bruto quita automaticamente', async () => {
      const db = fakeDb(); zeroRate(db);
      await svc(db).pay('t1', 'debt1', { amount: '1000' }, NOW);
      expect(db.debt.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { paidAmount: '1000.00', settledAt: NOW } }),
      );
    });
    it('ignora amount negativo (não reduz o pago)', async () => {
      const db = fakeDb(); db.debt.findFirst = vi.fn(async () => debtRow({ rate: dec('0'), paidAmount: dec('200') })) as never;
      await svc(db).pay('t1', 'debt1', { amount: '-500' }, NOW);
      expect(db.debt.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { paidAmount: '200.00', settledAt: null } }), // permanece 200
      );
    });
    it('cancela alertas pendentes (não lidos) da dívida', async () => {
      const db = fakeDb(); zeroRate(db);
      await svc(db).pay('t1', 'debt1', { full: true }, NOW);
      expect(db.notification.deleteMany).toHaveBeenCalledWith({ where: { tenantId: 't1', debtId: 'debt1', readAt: null } });
    });
    it('já quitada é idempotente (não atualiza nem mexe em alertas)', async () => {
      const db = fakeDb();
      db.debt.findFirst = vi.fn(async () => debtRow({ settledAt: new Date('2026-05-20T00:00:00Z') })) as never;
      await svc(db).pay('t1', 'debt1', { full: true }, NOW);
      expect(db.debt.update).not.toHaveBeenCalled();
      expect(db.notification.deleteMany).not.toHaveBeenCalled();
    });
    it('pagamento em dívida de outro tenant → NotFound', async () => {
      await expect(svc(fakeDb()).pay('t2', 'debt1', { full: true }, NOW)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

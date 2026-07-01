import { describe, it, expect, vi } from 'vitest';
import { DebtsService } from './debts.service.js';
import { TrackingService } from '../tracking/tracking.service.js';
import { NotFoundException, BadRequestException } from '@nestjs/common';

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
      findUnique: vi.fn(async () => ({ name: 'Cliente A' })),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'dq', ...data })),
    },
    debtorAccess: { create: vi.fn(async () => ({})), findFirst: vi.fn(async () => null) },
    debtorLoginEvent: { findMany: vi.fn(async () => []) },
    platformEvent: { create: vi.fn(async () => ({})), findMany: vi.fn(async () => []) },
    notification: { findMany: vi.fn(async () => []), deleteMany: vi.fn(async () => ({ count: 0 })), upsert: vi.fn(async () => ({})) },
    debt: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'debt1', ...data })),
      update: vi.fn(async () => ({})),
      findMany: vi.fn(async () => [{ id: 'debt1' }]),
      count: vi.fn(async () => 1),
      findFirst: vi.fn(async ({ where }: { where: { id: string; tenantId: string } }) =>
        where.id === 'debt1' && where.tenantId === 't1' ? debtRow() : null),
      delete: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
    paymentClaim: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async ({ where }: { where: { id: string; tenantId: string } }) =>
        where.id === 'claim1' && where.tenantId === 't1'
          ? { id: 'claim1', tenantId: 't1', debtId: 'debt1', status: 'PENDING', amount: dec('300.00') }
          : null),
      update: vi.fn(async () => ({})),
    },
  };
}
// withTenant executa o callback com o db fake como "tx" (a transação real só roda em runtime).
const tracking = new TrackingService({ raw: () => ({}) } as never);
const svc = (db: ReturnType<typeof fakeDb>) =>
  new DebtsService({ withTenant: async (_t: string, fn: (tx: typeof db) => unknown) => fn(db) } as never, tracking);
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
    expect(db.debt.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 't1', deletedAt: null }, take: 20, skip: 0 }));
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
    it('inclui "Operação quitada" quando há settledAt', async () => {
      const db = fakeDb();
      db.debt.findFirst = vi.fn(async () => debtRow({ settledAt: new Date('2026-06-15T00:00:00Z') })) as never;
      const events = await svc(db).history('t1', 'debt1', new Date('2026-06-20T00:00:00Z'));
      expect(events.some((e) => e.kind === 'paid' && e.title === 'Operação quitada')).toBe(true);
    });
    it('inclui alterações e pagamentos (parciais) registrados pelo tracking', async () => {
      const db = fakeDb();
      db.platformEvent.findMany = vi.fn(async () => [
        { type: 'OPERATION_UPDATED', at: new Date('2026-05-20T00:00:00Z'), detail: { field: 'tags' } },
        { type: 'OPERATION_PAID', at: new Date('2026-05-25T00:00:00Z'), detail: { paidAmount: '500.00', settled: false } },
      ]) as never;
      const events = await svc(db).history('t1', 'debt1', new Date('2026-06-01T00:00:00Z'));
      expect(events.some((e) => e.kind === 'updated' && e.title === 'Etiquetas atualizadas')).toBe(true);
      expect(events.some((e) => e.kind === 'paid' && e.title === 'Pagamento registrado' && e.detail === 'Pagamento de R$ 500.00')).toBe(true);
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

  describe('remove (lixeira / soft-delete)', () => {
    it('marca deletedAt (não apaga) + limpa alertas + registra o tracking', async () => {
      const db = fakeDb();
      const NOW = new Date('2026-06-10T00:00:00Z');
      await svc(db).remove('t1', 'debt1', NOW);
      expect(db.notification.deleteMany).toHaveBeenCalledWith({ where: { tenantId: 't1', debtId: 'debt1' } });
      expect(db.debt.update).toHaveBeenCalledWith({ where: { id: 'debt1' }, data: { deletedAt: NOW } });
      expect(db.debt.delete).not.toHaveBeenCalled();
      expect(db.platformEvent.create).toHaveBeenCalled();
    });
    it('excluir dívida de outro tenant → NotFound (não marca)', async () => {
      const db = fakeDb();
      await expect(svc(db).remove('t2', 'debt1')).rejects.toBeInstanceOf(NotFoundException);
      expect(db.debt.update).not.toHaveBeenCalled();
    });
  });

  describe('lixeira (restore / purge)', () => {
    it('restore só funciona em dívida que está na lixeira', async () => {
      const db = fakeDb();
      db.debt.findFirst = vi.fn(async ({ where }: { where: { deletedAt?: unknown } }) =>
        where.deletedAt ? { id: 'debt1', tenantId: 't1' } : null) as never;
      await svc(db).restore('t1', 'debt1');
      expect(db.debt.update).toHaveBeenCalledWith({ where: { id: 'debt1' }, data: { deletedAt: null } });
    });
    it('restore de dívida que não está na lixeira → NotFound', async () => {
      const db = fakeDb();
      db.debt.findFirst = vi.fn(async () => null) as never;
      await expect(svc(db).restore('t1', 'debt1')).rejects.toBeInstanceOf(NotFoundException);
    });
    it('purgeTrashed apaga de vez as dívidas na lixeira além do corte', async () => {
      const db = fakeDb();
      const NOW = new Date('2026-06-30T00:00:00Z');
      await svc(db).purgeTrashed('t1', 30, NOW);
      expect(db.debt.deleteMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: 't1', deletedAt: expect.objectContaining({ not: null }) }) }));
    });
  });

  describe('renegotiate (refazer o acordo)', () => {
    const NOW = new Date('2026-06-01T00:00:00Z');
    it('re-baseia: devido vira novo principal, pago=0, novo vencimento; registra renegociação', async () => {
      const db = fakeDb();
      db.debt.findFirst = vi.fn(async () => debtRow({ rate: dec('0') })) as never; // bruto = principal = 1000
      await svc(db).renegotiate('t1', 'debt1', { dueDate: '2026-09-01T00:00:00Z' }, NOW);
      expect(db.debt.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ principal: '1000.00', paidAmount: '0', settledAt: null, dueDate: new Date('2026-09-01T00:00:00Z') }),
      }));
      expect(db.platformEvent.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ type: 'OPERATION_UPDATED', detail: expect.objectContaining({ renegotiated: true }) }),
      }));
    });
    it('recusa renegociar operação quitada', async () => {
      const db = fakeDb();
      db.debt.findFirst = vi.fn(async () => debtRow({ settledAt: new Date('2026-05-01T00:00:00Z') })) as never;
      await expect(svc(db).renegotiate('t1', 'debt1', { dueDate: '2026-09-01T00:00:00Z' }, NOW)).rejects.toBeInstanceOf(BadRequestException);
    });
    it('recusa novo vencimento no passado', async () => {
      const db = fakeDb();
      db.debt.findFirst = vi.fn(async () => debtRow({ rate: dec('0') })) as never;
      await expect(svc(db).renegotiate('t1', 'debt1', { dueDate: '2026-05-01T00:00:00Z' }, NOW)).rejects.toBeInstanceOf(BadRequestException);
    });
    it('renegociar de outro tenant → NotFound', async () => {
      await expect(svc(fakeDb()).renegotiate('t2', 'debt1', { dueDate: '2026-09-01T00:00:00Z' }, NOW)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('claims (confirmação de pagamento informado pelo sobrinho)', () => {
    it('confirmClaim aplica o pagamento (valor do claim) e marca CONFIRMED', async () => {
      const db = fakeDb();
      db.debt.findFirst = vi.fn(async () => debtRow({ rate: dec('0') })) as never; // bruto = 1000
      await svc(db).confirmClaim('t1', 'claim1', new Date('2026-06-01T00:00:00Z'));
      // aplica 300 (valor do claim)
      expect(db.debt.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ paidAmount: '300.00' }) }));
      expect(db.paymentClaim.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'claim1' }, data: expect.objectContaining({ status: 'CONFIRMED' }) }));
    });
    it('confirmClaim de claim inexistente/não-PENDENTE → NotFound', async () => {
      const db = fakeDb();
      db.paymentClaim.findFirst = vi.fn(async () => null) as never;
      await expect(svc(db).confirmClaim('t1', 'x')).rejects.toBeInstanceOf(NotFoundException);
    });
    it('rejectClaim marca REJECTED e não toca na dívida', async () => {
      const db = fakeDb();
      await svc(db).rejectClaim('t1', 'claim1');
      expect(db.paymentClaim.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'claim1' }, data: expect.objectContaining({ status: 'REJECTED' }) }));
      expect(db.debt.update).not.toHaveBeenCalled();
    });
    it('pendingClaims devolve as informações pendentes com nome do sobrinho', async () => {
      const db = fakeDb();
      db.paymentClaim.findMany = vi.fn(async () => [{ id: 'claim1', debtId: 'debt1', amount: { toFixed: () => '300.00' }, note: 'pix', claimedAt: new Date('2026-06-01T00:00:00Z') }]) as never;
      db.debt.findMany = vi.fn(async () => [{ id: 'debt1', debtor: { name: 'Cliente A' } }]) as never;
      const out = await svc(db).pendingClaims('t1');
      expect(out).toEqual([{ id: 'claim1', debtId: 'debt1', debtorName: 'Cliente A', amount: '300.00', note: 'pix', claimedAt: '2026-06-01T00:00:00.000Z' }]);
    });
  });
});

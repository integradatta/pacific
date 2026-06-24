import { describe, it, expect, vi } from 'vitest';
import { RetentionScheduler } from './retention.scheduler.js';

function make() {
  const debtorLoginEvent = { deleteMany: vi.fn(async () => ({ count: 3 })) };
  const db = {
    platformEvent: { deleteMany: vi.fn(async () => ({ count: 10 })) },
    portfolioSnapshot: { deleteMany: vi.fn(async () => ({ count: 1 })) },
    tenant: { findMany: vi.fn(async () => [{ id: 't1' }, { id: 't2' }]) },
    debtorLoginEvent,
  };
  const scoped = { raw: () => db, withTenant: async (_t: string, fn: (tx: typeof db) => unknown) => fn(db) };
  return { sched: new RetentionScheduler(scoped as never), db, debtorLoginEvent };
}

describe('RetentionScheduler', () => {
  it('poda eventos/snapshots por data e logins por tenant (best-effort)', async () => {
    const { sched, db, debtorLoginEvent } = make();
    await sched.prune(new Date('2026-06-24T00:00:00Z'));
    expect(db.platformEvent.deleteMany).toHaveBeenCalledWith(expect.objectContaining({ where: { at: { lt: expect.any(Date) } } }));
    expect(db.portfolioSnapshot.deleteMany).toHaveBeenCalled();
    expect(debtorLoginEvent.deleteMany).toHaveBeenCalledTimes(2); // um por tenant
  });
});

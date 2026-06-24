import { describe, it, expect, vi } from 'vitest';
import { NotificationsScheduler } from './notifications.scheduler.js';

function make(tenants: { id: string }[], gen = vi.fn(async () => ({ created: 2 }))) {
  const scoped = { raw: () => ({ tenant: { findMany: vi.fn(async () => tenants) } }) };
  const notifications = { generateDueNotifications: gen };
  return { sched: new NotificationsScheduler(scoped as never, notifications as never), gen };
}

describe('NotificationsScheduler', () => {
  it('gera alertas para cada carteira aprovada+ativa', async () => {
    const { sched, gen } = make([{ id: 't1' }, { id: 't2' }]);
    await sched.generateForAllTenants();
    expect(gen).toHaveBeenCalledTimes(2);
    expect(gen).toHaveBeenCalledWith('t1');
    expect(gen).toHaveBeenCalledWith('t2');
  });

  it('uma carteira que falha não interrompe as demais (best-effort)', async () => {
    const gen = vi.fn(async (id: string) => {
      if (id === 't1') throw new Error('boom');
      return { created: 1 };
    });
    const { sched } = make([{ id: 't1' }, { id: 't2' }], gen);
    await expect(sched.generateForAllTenants()).resolves.toBeUndefined();
    expect(gen).toHaveBeenCalledTimes(2);
  });
});

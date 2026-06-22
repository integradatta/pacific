import { describe, it, expect, vi } from 'vitest';
import { NotificationsService } from './notifications.service.js';
import type { PushSender, PushMessage } from './push-sender.js';
import type { Querier } from '../common/geo-db.js';

function mkSender() {
  const sent: Array<{ tokens: string[]; message: PushMessage }> = [];
  const sender: PushSender = { send: vi.fn(async (tokens, message) => void sent.push({ tokens, message })) };
  return { sender, sent };
}

// q roteado por SQL: grupo, membros (admin/all), tokens.
function mkQ(opts: { groupType: string; notifEnabled: boolean; admins: string[]; all: string[]; tokens: Record<string, string> }): Querier {
  return {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes('FROM geo."group" WHERE id')) {
        return { rows: [{ group_type: opts.groupType, name: 'G', status_notification_enabled: opts.notifEnabled }] as never[], rowCount: 1 };
      }
      if (sql.includes("role = 'admin'")) return { rows: opts.admins.map((user_id) => ({ user_id })) as never[], rowCount: opts.admins.length };
      if (sql.includes('FROM geo.group_member')) return { rows: opts.all.map((user_id) => ({ user_id })) as never[], rowCount: opts.all.length };
      if (sql.includes('FROM geo.user_device')) {
        const ids = params[0] as string[];
        const rows = ids.map((id) => opts.tokens[id]).filter(Boolean).map((push_token) => ({ push_token }));
        return { rows: rows as never[], rowCount: rows.length };
      }
      return { rows: [] as never[], rowCount: 0 };
    }),
  };
}

describe('NotificationsService.notifyStatusChange', () => {
  it('supervised → notifica admins', async () => {
    const { sender, sent } = mkSender();
    const q = mkQ({ groupType: 'supervised', notifEnabled: true, admins: ['a1'], all: ['a1', 's1'], tokens: { a1: 'tok-a1', s1: 'tok-s1' } });
    await new NotificationsService(sender).notifyStatusChange(q, 'g1', 's1', 'unavailable');
    expect(sent).toHaveLength(1);
    expect(sent[0]!.tokens).toEqual(['tok-a1']);
    expect(sent[0]!.message.body).toMatch(/indispon|GPS|internet/i);
  });
  it('collaborative SEM consenso → não notifica', async () => {
    const { sender, sent } = mkSender();
    const q = mkQ({ groupType: 'collaborative', notifEnabled: false, admins: ['a1'], all: ['a1', 'b1'], tokens: { a1: 't', b1: 't2' } });
    await new NotificationsService(sender).notifyStatusChange(q, 'g1', 'b1', 'paused');
    expect(sent).toHaveLength(0);
    expect(sender.send).not.toHaveBeenCalled();
  });
  it('collaborative COM consenso → notifica os demais (exceto o ator)', async () => {
    const { sender, sent } = mkSender();
    const q = mkQ({ groupType: 'collaborative', notifEnabled: true, admins: ['a1'], all: ['a1', 'b1'], tokens: { a1: 'tok-a1', b1: 'tok-b1' } });
    await new NotificationsService(sender).notifyStatusChange(q, 'g1', 'b1', 'paused');
    expect(sent).toHaveLength(1);
    expect(sent[0]!.tokens).toEqual(['tok-a1']); // b1 (ator) excluído
  });
});

describe('NotificationsService.notifyGeofence', () => {
  it('alerta vai para os admins', async () => {
    const { sender, sent } = mkSender();
    const q = mkQ({ groupType: 'supervised', notifEnabled: true, admins: ['a1'], all: ['a1'], tokens: { a1: 'tok-a1' } });
    await new NotificationsService(sender).notifyGeofence(q, 'g1', 's1', 'Escola', 'enter');
    expect(sent[0]!.tokens).toEqual(['tok-a1']);
    expect(sent[0]!.message.body).toMatch(/entrou em "Escola"/);
  });
});

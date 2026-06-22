import { describe, it, expect, vi } from 'vitest';
import { HttpException } from '@nestjs/common';
import { GroupsService } from './groups.service.js';
import type { GeoDb, Querier } from '../../common/geo-db.js';

const P = { userId: 'u-self', tenantId: 't1', roles: [] };

// Fake db: roteia queries por substring do SQL + params. `handler` devolve {rows}.
function mkDb(handler: (sql: string, params: unknown[]) => { rows: unknown[] }): GeoDb {
  const q: Querier = {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      const { rows } = handler(sql, params);
      return { rows: rows as never[], rowCount: rows.length };
    }),
  };
  return { withTenant: async (_t, fn) => fn(q) };
}
const svc = (db: GeoDb) => new GroupsService(db);

describe('GroupsService.createGroup', () => {
  it('supervised → notificação on; cria admin', async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const db = mkDb((sql, params) => {
      calls.push({ sql, params });
      if (sql.includes('INSERT INTO geo."group"')) return { rows: [{ id: 'g1', group_type: 'supervised' }] };
      return { rows: [] };
    });
    await svc(db).createGroup(P, { groupType: 'supervised', name: 'Turma' });
    const groupInsert = calls.find((c) => c.sql.includes('INSERT INTO geo."group"'))!;
    expect(groupInsert.params).toContain(true); // status_notification_enabled = true
    expect(calls.some((c) => c.sql.includes('INSERT INTO geo.group_member') && c.sql.includes("'admin'"))).toBe(true);
  });
});

describe('GroupsService.changeRole', () => {
  function dbWith(selfRole: string, targetRole: string, groupType = 'supervised', adminCount = 2): GeoDb {
    return mkDb((sql, params) => {
      if (sql.includes('FROM geo."group" WHERE id')) return { rows: [{ id: 'g1', group_type: groupType }] };
      if (sql.includes('group_member WHERE group_id') && sql.includes('user_id')) {
        const uid = params[1];
        return { rows: [{ id: `m-${uid}`, user_id: uid, role: uid === 'u-self' ? selfRole : targetRole, status: 'active', sharing_status: 'active' }] };
      }
      if (sql.includes("role = 'admin'") && sql.includes('count')) return { rows: [{ n: adminCount }] };
      return { rows: [] };
    });
  }
  it('rejeita transição inválida (admin→supervised_participant) com 400', async () => {
    const err = await svc(dbWith('admin', 'admin')).changeRole(P, 'g1', 'u-tgt', 'supervised_participant').catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(400);
  });
  it('bloqueia rebaixar o último admin com 409', async () => {
    const err = await svc(dbWith('admin', 'admin', 'collaborative', 1)).changeRole(P, 'g1', 'u-self', 'participant').catch((e) => e);
    expect((err as HttpException).getStatus()).toBe(409);
  });
});

describe('GroupsService.removeMember', () => {
  it('bloqueia remover o último admin (409)', async () => {
    const db = mkDb((sql, params) => {
      if (sql.includes('FROM geo."group" WHERE id')) return { rows: [{ id: 'g1', group_type: 'collaborative' }] };
      if (sql.includes('group_member WHERE group_id') && sql.includes('user_id')) {
        const uid = params[1];
        return { rows: [{ id: `m-${uid}`, user_id: uid, role: 'admin', status: 'active', sharing_status: 'active' }] };
      }
      if (sql.includes('count')) return { rows: [{ n: 1 }] };
      return { rows: [] };
    });
    const err = await svc(db).removeMember(P, 'g1', 'u-tgt').catch((e) => e);
    expect((err as HttpException).getStatus()).toBe(409);
  });
});

describe('GroupsService.acceptInvite', () => {
  it('convite expirado/inexistente → 404', async () => {
    const db = mkDb((sql) => (sql.includes('FROM geo.group_invite') ? { rows: [] } : { rows: [] }));
    const err = await svc(db).acceptInvite(P, 'tok').catch((e) => e);
    expect((err as HttpException).getStatus()).toBe(404);
  });
});

describe('GroupsService.leave', () => {
  it('supervised_participant em grupo supervised não pode sair (403)', async () => {
    const db = mkDb((sql, params) => {
      if (sql.includes('FROM geo."group" WHERE id')) return { rows: [{ id: 'g1', group_type: 'supervised' }] };
      if (sql.includes('group_member WHERE group_id')) {
        return { rows: [{ id: 'm1', user_id: params[1], role: 'supervised_participant', status: 'active', sharing_status: 'active' }] };
      }
      return { rows: [] };
    });
    const err = await svc(db).leave(P, 'g1').catch((e) => e);
    expect((err as HttpException).getStatus()).toBe(403);
  });
});

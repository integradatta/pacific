import { describe, it, expect, vi } from 'vitest';
import { HttpException } from '@nestjs/common';
import { SharingService } from './sharing.service.js';
import type { GeoDb, Querier } from '../../common/geo-db.js';

const P = { userId: 'u1', tenantId: 't1', roles: [] };

function mkDb(member: { role: string; sharing_status: string } | null) {
  const updates: Array<{ sql: string; params: unknown[] }> = [];
  const q: Querier = {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes('SELECT id, user_id, role, sharing_status')) {
        return { rows: (member ? [{ id: 'm1', user_id: 'u1', ...member }] : []) as never[], rowCount: member ? 1 : 0 };
      }
      updates.push({ sql, params });
      return { rows: [] as never[], rowCount: 0 };
    }),
  };
  const db: GeoDb = { withTenant: async (_t, fn) => fn(q) };
  return { db, updates };
}

describe('SharingService.setOwnSharing', () => {
  it('pause de participant ativo → paused + consent_log', async () => {
    const { db, updates } = mkDb({ role: 'participant', sharing_status: 'active' });
    const out = await new SharingService(db).setOwnSharing(P, 'g1', 'pause');
    expect(out.status).toBe('paused');
    expect(updates.some((u) => u.sql.includes('UPDATE geo.group_member SET sharing_status') && u.params[0] === 'paused')).toBe(true);
    expect(updates.some((u) => u.sql.includes('INSERT INTO geo.consent_log'))).toBe(true);
  });
  it('supervised_participant não pode pausar (403)', async () => {
    const { db } = mkDb({ role: 'supervised_participant', sharing_status: 'active' });
    const err = await new SharingService(db).setOwnSharing(P, 'g1', 'pause').catch((e) => e);
    expect((err as HttpException).getStatus()).toBe(403);
  });
  it('resume a partir de active é inválido (409)', async () => {
    const { db } = mkDb({ role: 'participant', sharing_status: 'active' });
    const err = await new SharingService(db).setOwnSharing(P, 'g1', 'resume').catch((e) => e);
    expect((err as HttpException).getStatus()).toBe(409);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { SuperAdminService } from './super-admin.service.js';
import { NotFoundException } from '@nestjs/common';

const ACTOR = { supabaseId: 'sa-1', email: 'admin@pacific.dev' };

function fakeDb() {
  return {
    tenant: {
      findMany: vi.fn(async () => [
        { id: 't1', name: 'Carteira A', orgCode: 'PAC-A', status: 'ACTIVE', approval: 'PENDING', createdAt: new Date('2026-06-01T00:00:00Z'), _count: { users: 2 } },
      ]),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === 't1' ? { id: 't1' } : null)),
      update: vi.fn(async () => ({})),
    },
    user: { findMany: vi.fn(async () => [{ id: 'u1', email: 'c@x.com', role: 'CREDITOR', tenantId: 't1', createdAt: new Date('2026-06-02T00:00:00Z') }]) },
    adminAuditLog: { create: vi.fn(async () => ({})), findMany: vi.fn(async () => []) },
  };
}
const svc = (db: ReturnType<typeof fakeDb>) => new SuperAdminService({ raw: () => db } as never);

describe('SuperAdminService', () => {
  it('listTenants mapeia approval/status + userCount', async () => {
    const rows = await svc(fakeDb()).listTenants();
    expect(rows[0]).toMatchObject({ id: 't1', approval: 'PENDING', userCount: 2 });
  });
  it('listTenants filtra por approval', async () => {
    const db = fakeDb();
    await svc(db).listTenants('PENDING');
    expect(db.tenant.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { approval: 'PENDING' } }));
  });
  it('approveTenant atualiza approval+status e audita', async () => {
    const db = fakeDb();
    await svc(db).approveTenant(ACTOR, 't1');
    expect(db.tenant.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { approval: 'APPROVED', status: 'ACTIVE' } });
    expect(db.adminAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'tenant.approve', targetId: 't1', actorEmail: ACTOR.email }) }));
  });
  it('suspendTenant marca SUSPENDED e audita', async () => {
    const db = fakeDb();
    await svc(db).suspendTenant(ACTOR, 't1');
    expect(db.tenant.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { status: 'SUSPENDED' } });
    expect(db.adminAuditLog.create).toHaveBeenCalled();
  });
  it('tenant inexistente → NotFound (sem update/audit)', async () => {
    const db = fakeDb();
    await expect(svc(db).approveTenant(ACTOR, 'nope')).rejects.toBeInstanceOf(NotFoundException);
    expect(db.tenant.update).not.toHaveBeenCalled();
    expect(db.adminAuditLog.create).not.toHaveBeenCalled();
  });
});

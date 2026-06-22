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
    user: {
      findMany: vi.fn(async () => [{ id: 'u1', email: 'c@x.com', role: 'CREDITOR', tenantId: 't1', createdAt: new Date('2026-06-02T00:00:00Z') }]),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === 'u1' ? { id: 'u1', email: 'c@x.com' } : null)),
    },
    adminAuditLog: { create: vi.fn(async () => ({})), findMany: vi.fn(async () => []) },
    debtorAccess: {
      findMany: vi.fn(async () => [{ id: 'l1', debtorId: 'd1', tenantId: 't1', active: true, lastSeenAt: null, rotatedAt: null, createdAt: new Date('2026-06-03T00:00:00Z') }]),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === 'l1' ? { id: 'l1', debtorId: 'd1' } : null)),
      update: vi.fn(async () => ({})),
    },
    debtorLoginEvent: { count: vi.fn(async () => 3) },
  };
}
const mkAuthAdmin = () => ({ sendPasswordReset: vi.fn(async () => {}) });
const KPIS = { totalLent: '1000.00', totalReceivable: '600.00', totalReceived: '400.00', countActive: 1, countSettled: 1, countByStatus: { GREEN: 1, YELLOW: 0, ORANGE: 0, RED: 1 }, riskDistribution: { LOW: 1, MEDIUM: 0, HIGH: 0 } };
const mkDash = () => ({ kpis: vi.fn(async () => KPIS) });
const svc = (db: ReturnType<typeof fakeDb>, authAdmin = mkAuthAdmin(), dashboard = mkDash()) =>
  new SuperAdminService(
    { raw: () => db, withTenant: async (_t: string, fn: (tx: typeof db) => unknown) => fn(db) } as never,
    dashboard as never,
    authAdmin as never,
  );

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
  it('requestPasswordReset dispara reset (não expõe senha) e audita', async () => {
    const db = fakeDb();
    const authAdmin = mkAuthAdmin();
    await svc(db, authAdmin).requestPasswordReset(ACTOR, 'u1');
    expect(authAdmin.sendPasswordReset).toHaveBeenCalledWith('c@x.com');
    expect(db.adminAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'user.password_reset', targetId: 'u1' }) }));
  });
  it('reset de usuário inexistente → NotFound', async () => {
    await expect(svc(fakeDb()).requestPasswordReset(ACTOR, 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('overview agrega KPIs dos tenants aprovados+ativos', async () => {
    const db = fakeDb();
    db.tenant.findMany = vi.fn(async () => [
      { id: 't1', status: 'ACTIVE', approval: 'APPROVED', createdAt: new Date('2026-06-01T00:00:00Z') },
      { id: 't2', status: 'ACTIVE', approval: 'APPROVED', createdAt: new Date('2026-06-01T00:00:00Z') },
      { id: 't3', status: 'SUSPENDED', approval: 'APPROVED', createdAt: new Date('2026-06-01T00:00:00Z') },
    ]) as never;
    const o = await svc(db).overview(new Date('2026-07-01T12:00:00Z'));
    expect(o).toMatchObject({ creditorsTotal: 3, creditorsActive: 2, creditorsBlocked: 1 });
    expect(o.volumeLent).toBe('2000.00'); // 2 tenants × 1000
    expect(o.outstanding).toBe('1200.00'); // 2 × 600
    expect(o.operationsOverdue).toBe(2); // 2 × RED=1
    expect(o.loginsToday).toBe(6); // 2 × 3
  });

  it('accessLinks lista os links', async () => {
    const rows = await svc(fakeDb()).accessLinks();
    expect(rows[0]).toMatchObject({ id: 'l1', debtorId: 'd1', active: true });
  });
  it('revokeLink desativa + audita; inexistente → NotFound', async () => {
    const db = fakeDb();
    await svc(db).revokeLink(ACTOR, 'l1');
    expect(db.debtorAccess.update).toHaveBeenCalledWith({ where: { id: 'l1' }, data: { active: false } });
    expect(db.adminAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'link.revoke' }) }));
    await expect(svc(fakeDb()).revokeLink(ACTOR, 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });
  it('auditLog aplica filtro de ação', async () => {
    const db = fakeDb();
    await svc(db).auditLog({ action: 'tenant.approve', limit: 10 });
    expect(db.adminAuditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ action: { contains: 'tenant.approve' } }), take: 10 }));
  });
});

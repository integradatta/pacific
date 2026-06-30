import { describe, it, expect, vi } from 'vitest';
import { SuperAdminService } from './super-admin.service.js';
import { HttpException, NotFoundException } from '@nestjs/common';

const ACTOR = { supabaseId: 'sa-1', email: 'admin@pacific.dev' };

function fakeDb() {
  return {
    tenant: {
      findMany: vi.fn(async () => [
        { id: 't1', name: 'Carteira A', orgCode: 'PAC-A', status: 'ACTIVE', approval: 'PENDING', createdAt: new Date('2026-06-01T00:00:00Z'), _count: { users: 2 } },
      ]),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === 't1' ? { id: 't1', orgCode: 'PAC-A' } : null)),
      update: vi.fn(async () => ({})),
      delete: vi.fn(async () => ({})),
      count: vi.fn(async () => 0),
    },
    user: {
      findMany: vi.fn(async () => [{ id: 'u1', email: 'c@x.com', role: 'SUPER_ADMIN', tenantId: null, supabaseId: 'sb-u1', createdAt: new Date('2026-06-02T00:00:00Z') }]),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === 'u1' ? { id: 'u1', email: 'c@x.com', role: 'SUPER_ADMIN', supabaseId: 'sb-u1' } : null)),
      deleteMany: vi.fn(async () => ({ count: 1 })),
      updateMany: vi.fn(async () => ({ count: 1 })),
      update: vi.fn(async () => ({})),
    },
    adminAuditLog: { create: vi.fn(async () => ({})), findMany: vi.fn(async () => []) },
    debtorAccess: {
      findMany: vi.fn(async () => [{ id: 'l1', debtorId: 'd1', tenantId: 't1', active: true, lastSeenAt: null, rotatedAt: null, createdAt: new Date('2026-06-03T00:00:00Z') }]),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === 'l1' ? { id: 'l1', debtorId: 'd1' } : null)),
      update: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
    debt: { deleteMany: vi.fn(async () => ({ count: 2 })) },
    debtor: { deleteMany: vi.fn(async () => ({ count: 1 })) },
    notification: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    debtorLoginEvent: { count: vi.fn(async () => 3), deleteMany: vi.fn(async () => ({ count: 0 })) },
    tenantStats: { findMany: vi.fn(async () => []), upsert: vi.fn(async () => ({})) },
  };
}
const mkAuthAdmin = () => ({ sendPasswordReset: vi.fn(async () => {}), setBlocked: vi.fn(async () => {}), deleteUser: vi.fn(async () => {}) });
const KPIS = { totalLent: '1000.00', totalReceivable: '600.00', totalReceived: '400.00', countActive: 1, countSettled: 1, countByStatus: { GREEN: 1, YELLOW: 0, ORANGE: 0, RED: 1 }, riskDistribution: { LOW: 1, MEDIUM: 0, HIGH: 0 } };
const mkDash = () => ({ kpis: vi.fn(async () => KPIS), portfolio: vi.fn(async () => [{ id: 'op1' }]) });
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

  it('overview agrega KPIs dos tenants aprovados+ativos (counts via count, loop só nos ativos)', async () => {
    const db = fakeDb();
    db.tenant.count = vi.fn(async (args?: { where?: { status?: string; approval?: string; createdAt?: unknown } }) => {
      const w = args?.where;
      if (!w) return 3;
      if (w.status === 'SUSPENDED') return 1;
      if (w.approval === 'PENDING') return 0;
      if (w.approval === 'APPROVED' && w.status === 'ACTIVE') return 2;
      return 0;
    }) as never;
    db.tenant.findMany = vi.fn(async () => [{ id: 't1' }, { id: 't2' }]) as never; // só os ativos
    const o = await svc(db).overview(new Date('2026-07-01T12:00:00Z'));
    expect(o).toMatchObject({ creditorsTotal: 3, creditorsActive: 2, creditorsBlocked: 1 });
    expect(o.volumeLent).toBe('2000.00'); // 2 tenants × 1000
    expect(o.outstanding).toBe('1200.00'); // 2 × 600
    expect(o.operationsOverdue).toBe(2); // 2 × RED=1
    expect(o.loginsToday).toBe(6); // 2 × 3
  });

  it('overview usa TenantStats quando existem (sem varrer dívidas)', async () => {
    const db = fakeDb();
    db.tenant.count = vi.fn(async () => 2) as never;
    db.tenantStats.findMany = vi.fn(async () => [
      { tenantId: 't1', opsTotal: 5, opsActive: 3, opsOverdue: 1, totalLent: '1000.00', totalReceivable: '600.00', totalReceived: '200.00', loginsToday: 4 },
      { tenantId: 't2', opsTotal: 2, opsActive: 2, opsOverdue: 0, totalLent: '500.00', totalReceivable: '500.00', totalReceived: '0.00', loginsToday: 1 },
    ]) as never;
    const dash = mkDash();
    const o = await svc(db, mkAuthAdmin(), dash).overview(new Date('2026-07-01T12:00:00Z'));
    expect(o.operationsTotal).toBe(7);
    expect(o.volumeLent).toBe('1500.00');
    expect(o.outstanding).toBe('1100.00');
    expect(o.loginsToday).toBe(5);
    expect(dash.kpis).not.toHaveBeenCalled(); // caminho escalável: não computa por dívida
  });

  it('refreshStats faz upsert das stats por carteira ativa', async () => {
    const db = fakeDb();
    await svc(db).refreshStats(new Date('2026-07-01T12:00:00Z'));
    expect(db.tenantStats.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 't1' } }));
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

  it('setCreditorBlocked bane usuários no Supabase + suspende tenant + audita', async () => {
    const db = fakeDb();
    const authAdmin = mkAuthAdmin();
    await svc(db, authAdmin).setCreditorBlocked(ACTOR, 't1', true);
    expect(authAdmin.setBlocked).toHaveBeenCalledWith('sb-u1', true);
    expect(db.tenant.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { status: 'SUSPENDED' } });
    expect(db.adminAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'tenant.block' }) }));
  });

  it('tenantOperations devolve a carteira (portfolio)', async () => {
    expect(await svc(fakeDb()).tenantOperations('t1')).toEqual([{ id: 'op1' }]);
  });

  describe('OWNER — gestão de admins', () => {
    it('listAdmins filtra OWNER+SUPER_ADMIN', async () => {
      const db = fakeDb();
      await svc(db).listAdmins();
      expect(db.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { role: { in: ['OWNER', 'SUPER_ADMIN'] } } }));
    });
    it('revokeAdmin rebaixa p/ CREDITOR + revokedAfter + audita', async () => {
      const db = fakeDb();
      await svc(db).revokeAdmin(ACTOR, 'u1');
      expect(db.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { role: 'CREDITOR', revokedAfter: expect.any(Date) } });
      expect(db.adminAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'admin.revoke' }) }));
    });
    it('revokeAdmin recusa revogar a si mesmo', async () => {
      const db = fakeDb();
      db.user.findUnique = vi.fn(async () => ({ id: 'u1', email: 'c@x.com', role: 'SUPER_ADMIN', supabaseId: 'sa-1' })) as never; // = ACTOR
      const err = await svc(db).revokeAdmin(ACTOR, 'u1').catch((e) => e);
      expect((err as HttpException).getStatus()).toBe(400);
      expect(db.user.update).not.toHaveBeenCalled();
    });
    it('revokeAdmin recusa revogar um OWNER', async () => {
      const db = fakeDb();
      db.user.findUnique = vi.fn(async () => ({ id: 'u2', email: 'o@x.com', role: 'OWNER', supabaseId: 'sb-o' })) as never;
      const err = await svc(db).revokeAdmin(ACTOR, 'u2').catch((e) => e);
      expect((err as HttpException).getStatus()).toBe(400);
    });
    it('promoteToAdmin promove CREDITOR → SUPER_ADMIN + audita', async () => {
      const db = fakeDb();
      db.user.findUnique = vi.fn(async () => ({ id: 'u3', email: 'c@x.com', role: 'CREDITOR', supabaseId: 'sb-3' })) as never;
      await svc(db).promoteToAdmin(ACTOR, 'u3');
      expect(db.user.update).toHaveBeenCalledWith({ where: { id: 'u3' }, data: { role: 'SUPER_ADMIN' } });
      expect(db.adminAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'admin.promote' }) }));
    });
  });

  it('listUsers oculta OWNER da listagem (nem na resposta da API)', async () => {
    const db = fakeDb();
    await svc(db).listUsers();
    expect(db.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { role: { not: 'OWNER' } } }));
  });

  it('forceLogout marca revokedAfter por id do usuário (corte instantâneo) + audita', async () => {
    const db = fakeDb();
    await svc(db).forceLogout(ACTOR, 'u1');
    expect(db.user.updateMany).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { revokedAfter: expect.any(Date) } });
    expect(db.adminAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'user.force_logout' }) }));
  });

  it('setCreditorBlocked(true) também marca revokedAfter dos usuários (derruba sessões)', async () => {
    const db = fakeDb();
    await svc(db).setCreditorBlocked(ACTOR, 't1', true);
    expect(db.user.updateMany).toHaveBeenCalledWith({ where: { tenantId: 't1' }, data: { revokedAfter: expect.any(Date) } });
  });

  describe('deleteTenant', () => {
    it('exige orgCode correto (senão 400, sem apagar)', async () => {
      const db = fakeDb();
      const err = await svc(db).deleteTenant(ACTOR, 't1', 'ERRADO').catch((e) => e);
      expect((err as HttpException).getStatus()).toBe(400);
      expect(db.tenant.delete).not.toHaveBeenCalled();
    });
    it('com confirmação correta, apaga dados + tenant + usuários do Supabase + audita', async () => {
      const db = fakeDb();
      const authAdmin = mkAuthAdmin();
      await svc(db, authAdmin).deleteTenant(ACTOR, 't1', 'PAC-A');
      expect(db.debt.deleteMany).toHaveBeenCalledWith({ where: { tenantId: 't1' } });
      expect(db.debtor.deleteMany).toHaveBeenCalled();
      expect(db.user.deleteMany).toHaveBeenCalledWith({ where: { tenantId: 't1' } });
      expect(db.tenant.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
      expect(authAdmin.deleteUser).toHaveBeenCalledWith('sb-u1');
      expect(db.adminAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'tenant.delete' }) }));
    });
  });
});

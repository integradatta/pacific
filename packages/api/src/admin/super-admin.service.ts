import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import type { AdminAccessLinkRow, AdminAuditEntry, AdminCreditorRow, AdminOverview, AdminTenantRow, AdminUserRow, TenantApproval } from '@pacific/shared';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';
import { DashboardService } from '../dashboard/dashboard.service.js';
import { AUTH_ADMIN, type AuthAdmin } from './auth-admin.js';

export interface Actor {
  supabaseId: string;
  email: string;
}

function startOfTodayUTC(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// Super-admin opera CROSS-TENANT (sem app.current_tenant). Usa o cliente raw() — Tenant/User/
// AdminAuditLog/DebtorAccess ficam fora da RLS, então o owner acessa normalmente. Para dados sob
// RLS (Debt/DebtorLoginEvent), itera por tenant via withTenant (reusa DashboardService).
// Toda mutação é auditada.
@Injectable()
export class SuperAdminService {
  constructor(
    private readonly scoped: TenantScopedService,
    private readonly dashboard: DashboardService,
    @Inject(AUTH_ADMIN) private readonly authAdmin: AuthAdmin,
  ) {}
  private get db() {
    return this.scoped.raw();
  }

  /** KPIs globais da plataforma (cross-tenant). */
  async overview(now = new Date()): Promise<AdminOverview> {
    const tenants = await this.db.tenant.findMany({ select: { id: true, status: true, approval: true, createdAt: true } });
    const today = startOfTodayUTC(now);
    const o: AdminOverview = {
      creditorsTotal: tenants.length,
      creditorsActive: tenants.filter((t) => t.approval === 'APPROVED' && t.status === 'ACTIVE').length,
      creditorsBlocked: tenants.filter((t) => t.status === 'SUSPENDED').length,
      creditorsPending: tenants.filter((t) => t.approval === 'PENDING').length,
      newCreditorsToday: tenants.filter((t) => t.createdAt >= today).length,
      operationsTotal: 0,
      operationsActive: 0,
      operationsOverdue: 0,
      volumeLent: '0',
      outstanding: '0',
      received: '0',
      loginsToday: 0,
    };
    let volume = new Decimal(0);
    let outstanding = new Decimal(0);
    let received = new Decimal(0);
    for (const t of tenants) {
      if (t.approval !== 'APPROVED' || t.status !== 'ACTIVE') continue;
      const k = await this.dashboard.kpis(t.id, now);
      const statusTotal = k.countByStatus.GREEN + k.countByStatus.YELLOW + k.countByStatus.ORANGE + k.countByStatus.RED;
      o.operationsTotal += statusTotal + k.countSettled;
      o.operationsActive += k.countActive;
      o.operationsOverdue += k.countByStatus.RED;
      volume = volume.plus(k.totalLent);
      outstanding = outstanding.plus(k.totalReceivable);
      received = received.plus(k.totalReceived);
      o.loginsToday += await this.scoped.withTenant(t.id, (tx) =>
        tx.debtorLoginEvent.count({ where: { tenantId: t.id, success: true, at: { gte: today } } }),
      );
    }
    o.volumeLent = volume.toFixed(2);
    o.outstanding = outstanding.toFixed(2);
    o.received = received.toFixed(2);
    return o;
  }

  /** Credores com agregados de carteira (a receber + nº de operações). */
  async creditors(now = new Date()): Promise<AdminCreditorRow[]> {
    const tenants = await this.db.tenant.findMany({
      include: { users: { where: { role: 'CREDITOR' }, select: { email: true }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });
    const out: AdminCreditorRow[] = [];
    for (const t of tenants) {
      let operationsCount = 0;
      let walletValue = '0.00';
      if (t.approval === 'APPROVED' && t.status === 'ACTIVE') {
        const k = await this.dashboard.kpis(t.id, now);
        operationsCount = k.countByStatus.GREEN + k.countByStatus.YELLOW + k.countByStatus.ORANGE + k.countByStatus.RED + k.countSettled;
        walletValue = k.totalReceivable;
      }
      out.push({
        tenantId: t.id,
        name: t.name,
        orgCode: t.orgCode,
        email: t.users[0]?.email ?? null,
        createdAt: t.createdAt.toISOString(),
        status: t.status as AdminCreditorRow['status'],
        approval: t.approval as TenantApproval,
        operationsCount,
        walletValue,
      });
    }
    return out;
  }

  /** Links de acesso de devedores (cross-tenant; DebtorAccess fica fora da RLS). */
  async accessLinks(limit = 200): Promise<AdminAccessLinkRow[]> {
    const rows = await this.db.debtorAccess.findMany({ orderBy: { createdAt: 'desc' }, take: Math.min(Math.max(limit, 1), 1000) });
    return rows.map((a) => ({
      id: a.id,
      debtorId: a.debtorId,
      tenantId: a.tenantId,
      active: a.active,
      lastSeenAt: a.lastSeenAt ? a.lastSeenAt.toISOString() : null,
      rotatedAt: a.rotatedAt ? a.rotatedAt.toISOString() : null,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  async revokeLink(actor: Actor, id: string): Promise<void> {
    const link = await this.db.debtorAccess.findUnique({ where: { id } });
    if (!link) throw new NotFoundException('Link não encontrado');
    await this.db.debtorAccess.update({ where: { id }, data: { active: false } });
    await this.audit(actor, 'link.revoke', 'debtorAccess', id, { debtorId: link.debtorId });
  }

  async listTenants(approval?: TenantApproval): Promise<AdminTenantRow[]> {
    const rows = await this.db.tenant.findMany({
      where: approval ? { approval } : undefined,
      include: { _count: { select: { users: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((t) => ({
      id: t.id,
      name: t.name,
      orgCode: t.orgCode,
      status: t.status as AdminTenantRow['status'],
      approval: t.approval as TenantApproval,
      createdAt: t.createdAt.toISOString(),
      userCount: t._count.users,
    }));
  }

  approveTenant(actor: Actor, id: string): Promise<void> {
    return this.mutateTenant(actor, id, { approval: 'APPROVED', status: 'ACTIVE' }, 'tenant.approve');
  }
  rejectTenant(actor: Actor, id: string): Promise<void> {
    return this.mutateTenant(actor, id, { approval: 'REJECTED' }, 'tenant.reject');
  }
  suspendTenant(actor: Actor, id: string): Promise<void> {
    return this.mutateTenant(actor, id, { status: 'SUSPENDED' }, 'tenant.suspend');
  }
  reactivateTenant(actor: Actor, id: string): Promise<void> {
    return this.mutateTenant(actor, id, { status: 'ACTIVE' }, 'tenant.reactivate');
  }

  /** Dispara reset de senha (NÃO expõe senha — hash é irrecuperável). Audita o ato. */
  async requestPasswordReset(actor: Actor, userId: string): Promise<void> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    await this.authAdmin.sendPasswordReset(user.email);
    await this.audit(actor, 'user.password_reset', 'user', userId, { email: user.email });
  }

  async listUsers(): Promise<AdminUserRow[]> {
    const rows = await this.db.user.findMany({
      select: { id: true, email: true, role: true, tenantId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role as AdminUserRow['role'],
      tenantId: u.tenantId,
      createdAt: u.createdAt.toISOString(),
    }));
  }

  async auditLog(filters: { action?: string; from?: string; to?: string; limit?: number } = {}): Promise<AdminAuditEntry[]> {
    const createdAt =
      filters.from || filters.to ? { gte: filters.from ? new Date(filters.from) : undefined, lte: filters.to ? new Date(filters.to) : undefined } : undefined;
    const rows = await this.db.adminAuditLog.findMany({
      where: { ...(filters.action ? { action: { contains: filters.action } } : {}), ...(createdAt ? { createdAt } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(filters.limit ?? 100, 1), 500),
    });
    return rows.map((a) => ({
      id: a.id,
      actorEmail: a.actorEmail,
      action: a.action,
      targetType: a.targetType,
      targetId: a.targetId,
      detail: a.detail,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  private async mutateTenant(
    actor: Actor,
    id: string,
    data: { approval?: TenantApproval; status?: 'ACTIVE' | 'SUSPENDED' },
    action: string,
  ): Promise<void> {
    const tenant = await this.db.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    await this.db.tenant.update({ where: { id }, data });
    await this.audit(actor, action, 'tenant', id, data);
  }

  private async audit(actor: Actor, action: string, targetType: string, targetId: string, detail: unknown): Promise<void> {
    await this.db.adminAuditLog.create({
      data: { actorSupabaseId: actor.supabaseId, actorEmail: actor.email, action, targetType, targetId, detail: detail as object },
    });
  }
}

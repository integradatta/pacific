import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AdminAuditEntry, AdminTenantRow, AdminUserRow, TenantApproval } from '@pacific/shared';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';
import { AUTH_ADMIN, type AuthAdmin } from './auth-admin.js';

export interface Actor {
  supabaseId: string;
  email: string;
}

// Super-admin opera CROSS-TENANT (sem app.current_tenant). Usa o cliente raw() — Tenant/User/
// AdminAuditLog ficam fora da RLS, então o owner acessa normalmente. Toda mutação é auditada.
@Injectable()
export class SuperAdminService {
  constructor(
    private readonly scoped: TenantScopedService,
    @Inject(AUTH_ADMIN) private readonly authAdmin: AuthAdmin,
  ) {}
  private get db() {
    return this.scoped.raw();
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

  async auditLog(limit = 100): Promise<AdminAuditEntry[]> {
    const rows = await this.db.adminAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: Math.min(Math.max(limit, 1), 500) });
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

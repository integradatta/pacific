import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
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

// Limites de página: protege contra carregar tabelas inteiras (escala p/ milhões de registros).
const clampTake = (n: number | undefined, def = 100, max = 500): number => Math.min(Math.max(n ?? def, 1), max);
const clampSkip = (n: number | undefined): number => Math.max(n ?? 0, 0);

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

  // Cache curto do overview: agrega cross-tenant (caro). Evita recomputar a cada acesso de
  // admin sob concorrência. TTL pequeno = dados quase em tempo real sem martelar o banco.
  private overviewCache: { at: number; value: AdminOverview } | null = null;
  private static readonly OVERVIEW_TTL_MS = 60_000;

  /** KPIs globais da plataforma (cross-tenant). Counts via SQL (escala); agregados financeiros
   *  por tenant (computados — ver docs/SCALABILITY.md p/ o caminho de stats materializadas). */
  async overview(now = new Date()): Promise<AdminOverview> {
    const cached = this.overviewCache;
    if (cached && Date.now() - cached.at < SuperAdminService.OVERVIEW_TTL_MS) return cached.value;

    const today = startOfTodayUTC(now);
    // Contagens via count() (indexável; não carrega todas as linhas) + stats materializadas.
    const [creditorsTotal, creditorsActive, creditorsBlocked, creditorsPending, newCreditorsToday, stats] = await Promise.all([
      this.db.tenant.count(),
      this.db.tenant.count({ where: { approval: 'APPROVED', status: 'ACTIVE' } }),
      this.db.tenant.count({ where: { status: 'SUSPENDED' } }),
      this.db.tenant.count({ where: { approval: 'PENDING' } }),
      this.db.tenant.count({ where: { createdAt: { gte: today } } }),
      this.db.tenantStats.findMany(),
    ]);
    const o: AdminOverview = {
      creditorsTotal, creditorsActive, creditorsBlocked, creditorsPending, newCreditorsToday,
      operationsTotal: 0, operationsActive: 0, operationsOverdue: 0,
      volumeLent: '0', outstanding: '0', received: '0', loginsToday: 0,
    };
    let volume = new Decimal(0);
    let outstanding = new Decimal(0);
    let received = new Decimal(0);

    if (stats.length > 0) {
      // Caminho escalável: agrega das stats materializadas (1 linha por tenant; sem varrer dívidas).
      for (const s of stats) {
        o.operationsTotal += s.opsTotal;
        o.operationsActive += s.opsActive;
        o.operationsOverdue += s.opsOverdue;
        o.loginsToday += s.loginsToday;
        volume = volume.plus(s.totalLent.toString());
        outstanding = outstanding.plus(s.totalReceivable.toString());
        received = received.plus(s.totalReceived.toString());
      }
    } else {
      // Fallback (antes do 1º refresh do job): computa ao vivo por tenant.
      const activeTenants = await this.db.tenant.findMany({ where: { approval: 'APPROVED', status: 'ACTIVE' }, select: { id: true } });
      for (const t of activeTenants) {
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
    }
    o.volumeLent = volume.toFixed(2);
    o.outstanding = outstanding.toFixed(2);
    o.received = received.toFixed(2);
    this.overviewCache = { at: Date.now(), value: o };
    return o;
  }

  /**
   * Recalcula as stats materializadas por tenant (job diário; pesado, roda fora do request).
   * É a computação cara que o overview deixa de fazer a cada acesso.
   */
  async refreshStats(now = new Date()): Promise<{ tenants: number }> {
    const today = startOfTodayUTC(now);
    const tenants = await this.db.tenant.findMany({ where: { approval: 'APPROVED', status: 'ACTIVE' }, select: { id: true } });
    for (const t of tenants) {
      const k = await this.dashboard.kpis(t.id, now);
      const opsTotal = k.countByStatus.GREEN + k.countByStatus.YELLOW + k.countByStatus.ORANGE + k.countByStatus.RED + k.countSettled;
      const loginsToday = await this.scoped.withTenant(t.id, (tx) =>
        tx.debtorLoginEvent.count({ where: { tenantId: t.id, success: true, at: { gte: today } } }),
      );
      const data = {
        opsTotal, opsActive: k.countActive, opsOverdue: k.countByStatus.RED,
        totalLent: k.totalLent, totalReceivable: k.totalReceivable, totalReceived: k.totalReceived,
        loginsToday, refreshedAt: now,
      };
      await this.db.tenantStats.upsert({ where: { tenantId: t.id }, create: { tenantId: t.id, ...data }, update: data });
    }
    return { tenants: tenants.length };
  }

  /** Credores com agregados de carteira (a receber + nº de operações). Paginado: o N+1 de KPIs
   *  fica limitado ao tamanho da página (escala por página, não pela base inteira). */
  async creditors(limit?: number, offset?: number, now = new Date()): Promise<AdminCreditorRow[]> {
    const tenants = await this.db.tenant.findMany({
      include: { users: { where: { role: 'CREDITOR' }, select: { email: true }, take: 1 } },
      orderBy: { createdAt: 'desc' },
      take: clampTake(limit),
      skip: clampSkip(offset),
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
  async accessLinks(limit?: number, offset?: number): Promise<AdminAccessLinkRow[]> {
    const rows = await this.db.debtorAccess.findMany({ orderBy: { createdAt: 'desc' }, take: clampTake(limit, 200), skip: clampSkip(offset) });
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

  async listTenants(approval?: TenantApproval, limit?: number, offset?: number): Promise<AdminTenantRow[]> {
    const rows = await this.db.tenant.findMany({
      where: approval ? { approval } : undefined,
      include: { _count: { select: { users: true } } },
      orderBy: { createdAt: 'desc' },
      take: clampTake(limit),
      skip: clampSkip(offset),
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

  /** Operações (carteira) de qualquer credor — visão global, RLS-safe via DashboardService. */
  async tenantOperations(tenantId: string) {
    return this.dashboard.portfolio(tenantId);
  }

  /**
   * Bloqueia/desbloqueia um credor: bane os usuários no Supabase (impede login/refresh — efetivo
   * como force-logout no TTL do token) e marca o tenant SUSPENDED/ACTIVE. Audita.
   */
  async setCreditorBlocked(actor: Actor, tenantId: string, blocked: boolean): Promise<void> {
    const tenant = await this.db.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Credor não encontrado');
    const users = await this.db.user.findMany({ where: { tenantId, role: 'CREDITOR' }, select: { supabaseId: true } });
    for (const u of users) await this.authAdmin.setBlocked(u.supabaseId, blocked);
    // Bloquear = derruba sessões atuais JÁ (revokedAfter) + impede re-login (ban acima).
    if (blocked) await this.db.user.updateMany({ where: { tenantId }, data: { revokedAfter: new Date() } });
    await this.db.tenant.update({ where: { id: tenantId }, data: { status: blocked ? 'SUSPENDED' : 'ACTIVE' } });
    await this.audit(actor, blocked ? 'tenant.block' : 'tenant.unblock', 'tenant', tenantId, { users: users.length });
  }

  /** Força logout instantâneo de um usuário (revokedAfter = agora; tokens atuais caem já). Audita. */
  async forceLogout(actor: Actor, userId: string): Promise<void> {
    await this.db.user.updateMany({ where: { id: userId }, data: { revokedAfter: new Date() } });
    await this.audit(actor, 'user.force_logout', 'user', userId, {});
  }

  /**
   * EXCLUI um credor e todos os seus dados (fluxo seguro: exige confirmação do orgCode).
   * Destrutivo e irreversível. Mantém AdminAuditLog (trilha). Audita a exclusão.
   */
  async deleteTenant(actor: Actor, tenantId: string, confirmOrgCode: string): Promise<void> {
    const tenant = await this.db.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Credor não encontrado');
    if (confirmOrgCode !== tenant.orgCode) {
      throw new BadRequestException('Confirmação não confere. Digite o código da organização para excluir.');
    }
    const users = await this.db.user.findMany({ where: { tenantId }, select: { supabaseId: true } });
    // Dados sob RLS: apaga dentro do contexto do tenant (ordem segura de FKs).
    await this.scoped.withTenant(tenantId, async (tx) => {
      await tx.debt.deleteMany({ where: { tenantId } });
      await tx.debtor.deleteMany({ where: { tenantId } });
      await tx.notification.deleteMany({ where: { tenantId } });
      await tx.debtorLoginEvent.deleteMany({ where: { tenantId } });
    });
    // Tabelas fora da RLS:
    await this.db.debtorAccess.deleteMany({ where: { tenantId } });
    await this.db.user.deleteMany({ where: { tenantId } });
    await this.db.tenant.delete({ where: { id: tenantId } });
    for (const u of users) await this.authAdmin.deleteUser(u.supabaseId).catch(() => undefined);
    await this.audit(actor, 'tenant.delete', 'tenant', tenantId, { orgCode: tenant.orgCode, users: users.length });
  }

  /** Dispara reset de senha (NÃO expõe senha — hash é irrecuperável). Audita o ato. */
  async requestPasswordReset(actor: Actor, userId: string): Promise<void> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    await this.authAdmin.sendPasswordReset(user.email);
    await this.audit(actor, 'user.password_reset', 'user', userId, { email: user.email });
  }

  // ── OWNER (admin supremo) — gestão dos administradores ──

  /** OWNER: lista os administradores (OWNER + SUPER_ADMIN). */
  async listAdmins(): Promise<AdminUserRow[]> {
    const rows = await this.db.user.findMany({
      where: { role: { in: ['OWNER', 'SUPER_ADMIN'] } },
      select: { id: true, email: true, role: true, tenantId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((u) => ({ id: u.id, email: u.email, role: u.role as AdminUserRow['role'], tenantId: u.tenantId, createdAt: u.createdAt.toISOString() }));
  }

  /**
   * OWNER: revoga o acesso de um SUPER_ADMIN — rebaixa para CREDITOR (sem carteira → o gate bloqueia)
   * e derruba as sessões ativas (revokedAfter = agora). Não revoga um OWNER nem a si mesmo. Audita.
   */
  async revokeAdmin(actor: Actor, userId: string): Promise<void> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    if (user.supabaseId === actor.supabaseId) throw new BadRequestException('Você não pode revogar o próprio acesso.');
    if (user.role === 'OWNER') throw new BadRequestException('Não é possível revogar um proprietário.');
    if (user.role !== 'SUPER_ADMIN') throw new BadRequestException('O usuário não é um administrador.');
    await this.db.user.update({ where: { id: userId }, data: { role: 'CREDITOR', revokedAfter: new Date() } });
    await this.audit(actor, 'admin.revoke', 'user', userId, { email: user.email });
  }

  /** OWNER: promove um usuário a SUPER_ADMIN. Audita. */
  async promoteToAdmin(actor: Actor, userId: string): Promise<void> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    if (user.role === 'OWNER' || user.role === 'SUPER_ADMIN') throw new BadRequestException('O usuário já é administrador.');
    await this.db.user.update({ where: { id: userId }, data: { role: 'SUPER_ADMIN' } });
    await this.audit(actor, 'admin.promote', 'user', userId, { email: user.email });
  }

  async listUsers(limit?: number, offset?: number): Promise<AdminUserRow[]> {
    const rows = await this.db.user.findMany({
      // OWNER (proprietário) é invisível na listagem — nem na resposta da API. SUPER_ADMIN e
      // demais papéis continuam aparecendo (um admin pode ver outros admins).
      where: { role: { not: 'OWNER' } },
      select: { id: true, email: true, role: true, tenantId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: clampTake(limit),
      skip: clampSkip(offset),
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

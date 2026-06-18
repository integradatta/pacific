import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';
import { generateAccessToken, hashAccessToken } from '../auth/access-token.util.js';
import type { Page } from '../common/pagination.js';

export interface DebtorListItem { id: string; name: string; active: boolean; lastSeenAt: Date | null; }

@Injectable()
export class DebtorsAdminService {
  constructor(private readonly scoped: TenantScopedService) {}

  private link(token: string): string {
    return `${process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/d/${token}`;
  }

  async create(tenantId: string, name: string): Promise<{ debtorId: string; accessLink: string }> {
    const token = generateAccessToken();
    const tokenHash = hashAccessToken(token);
    const debtorId = await this.scoped.withTenant(tenantId, async (tx) => {
      const debtor = await tx.debtor.create({ data: { tenantId, name } });
      await tx.debtorAccess.create({ data: { debtorId: debtor.id, tenantId, tokenHash } });
      return debtor.id;
    });
    return { debtorId, accessLink: this.link(token) };
  }

  async setActive(tenantId: string, debtorId: string, active: boolean): Promise<void> {
    await this.scoped.withTenant(tenantId, async (tx) => {
      const res = await tx.debtorAccess.updateMany({ where: { debtorId, tenantId }, data: { active } });
      if (res.count === 0) throw new NotFoundException('Devedor não encontrado');
    });
  }

  async rotateLink(tenantId: string, debtorId: string): Promise<{ accessLink: string }> {
    const token = generateAccessToken();
    const tokenHash = hashAccessToken(token);
    await this.scoped.withTenant(tenantId, async (tx) => {
      const res = await tx.debtorAccess.updateMany({
        where: { debtorId, tenantId },
        data: { tokenHash, rotatedAt: new Date(), active: true },
      });
      if (res.count === 0) throw new NotFoundException('Devedor não encontrado');
    });
    return { accessLink: this.link(token) };
  }

  async list(tenantId: string, page: { limit: number; offset: number }): Promise<Page<DebtorListItem>> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const [debtors, total] = await Promise.all([
        tx.debtor.findMany({ where: { tenantId }, take: page.limit, skip: page.offset, orderBy: { createdAt: 'desc' } }),
        tx.debtor.count({ where: { tenantId } }),
      ]);
      const accesses = await tx.debtorAccess.findMany({ where: { tenantId, debtorId: { in: debtors.map((d) => d.id) } } });
      const byDebtor = new Map(accesses.map((a) => [a.debtorId, a]));
      const items: DebtorListItem[] = debtors.map((d) => ({
        id: d.id,
        name: d.name,
        active: byDebtor.get(d.id)?.active ?? false,
        lastSeenAt: byDebtor.get(d.id)?.lastSeenAt ?? null,
      }));
      return { items, total, limit: page.limit, offset: page.offset };
    });
  }

  async logins(tenantId: string, debtorId: string, page: { limit: number; offset: number }): Promise<Page<{ id: string; success: boolean; at: Date }>> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const [items, total] = await Promise.all([
        tx.debtorLoginEvent.findMany({ where: { tenantId, debtorId }, take: page.limit, skip: page.offset, orderBy: { at: 'desc' } }),
        tx.debtorLoginEvent.count({ where: { tenantId, debtorId } }),
      ]);
      return { items, total, limit: page.limit, offset: page.offset };
    });
  }
}

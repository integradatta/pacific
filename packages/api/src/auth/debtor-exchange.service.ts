import { Injectable, UnauthorizedException } from '@nestjs/common';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';
import { DebtorTokenService } from './debtor-token.service.js';
import { hashAccessToken } from './access-token.util.js';

@Injectable()
export class DebtorExchangeService {
  constructor(private readonly scoped: TenantScopedService, private readonly tokens: DebtorTokenService) {}

  async exchange(rawToken: string, ip?: string): Promise<{ token: string }> {
    const tokenHash = hashAccessToken(rawToken);
    const access = await this.scoped.raw().debtorAccess.findUnique({ where: { tokenHash } });
    if (!access || !access.active) throw new UnauthorizedException('Link inválido');
    await this.scoped.withTenant(access.tenantId, async (tx) => {
      await tx.debtorAccess.updateMany({ where: { debtorId: access.debtorId, tenantId: access.tenantId }, data: { lastSeenAt: new Date() } });
      await tx.debtorLoginEvent.create({ data: { debtorId: access.debtorId, tenantId: access.tenantId, success: true, ip: ip ?? null } });
    });
    return { token: this.tokens.sign({ debtorId: access.debtorId, tenantId: access.tenantId }) };
  }
}

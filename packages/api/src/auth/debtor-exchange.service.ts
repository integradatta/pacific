import { Injectable, UnauthorizedException } from '@nestjs/common';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';
import { TrackingService } from '../tracking/tracking.service.js';
import { DebtorTokenService } from './debtor-token.service.js';
import { hashAccessToken } from './access-token.util.js';
import { notifyCreditor } from '../notifications/notify.js';

@Injectable()
export class DebtorExchangeService {
  constructor(
    private readonly scoped: TenantScopedService,
    private readonly tokens: DebtorTokenService,
    private readonly tracking: TrackingService,
  ) {}

  async exchange(rawToken: string, ip?: string): Promise<{ token: string }> {
    const tokenHash = hashAccessToken(rawToken);
    const access = await this.scoped.raw().debtorAccess.findUnique({ where: { tokenHash } });
    if (!access || !access.active) throw new UnauthorizedException('Link inválido');
    await this.scoped.withTenant(access.tenantId, async (tx) => {
      // Primeiro acesso = ainda não havia login bem-sucedido antes deste.
      const priorLogins = await tx.debtorLoginEvent.count({ where: { debtorId: access.debtorId, tenantId: access.tenantId, success: true } });
      await tx.debtorAccess.updateMany({ where: { debtorId: access.debtorId, tenantId: access.tenantId }, data: { lastSeenAt: new Date() } });
      await tx.debtorLoginEvent.create({ data: { debtorId: access.debtorId, tenantId: access.tenantId, success: true, ip: ip ?? null } });
      // Uso de link (magic link) — alimenta o feed de atividade do super-admin.
      await this.tracking.record(tx, { tenantId: access.tenantId, actorType: 'DEBTOR', actorId: access.debtorId, type: 'LINK_USED', targetType: 'debtorAccess', targetId: access.id, ip: ip ?? null });
      if (priorLogins === 0) {
        const d = await tx.debtor.findUnique({ where: { id: access.debtorId }, select: { name: true } });
        await notifyCreditor(tx, { tenantId: access.tenantId, debtorId: access.debtorId, type: 'DEBTOR_FIRST_ACCESS', title: 'Primeiro acesso', body: `${d?.name ?? 'Seu sobrinho'} abriu o link pela primeira vez.` });
      }
    });
    return { token: this.tokens.sign({ debtorId: access.debtorId, tenantId: access.tenantId }) };
  }
}

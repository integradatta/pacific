import { Injectable, UnauthorizedException } from '@nestjs/common';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';
import { TrackingService } from '../tracking/tracking.service.js';
import { DebtorTokenService } from './debtor-token.service.js';
import { hashAccessToken } from './access-token.util.js';
import { notifyCreditor } from '../notifications/notify.js';
import { PushService } from '../notifications/push.service.js';

@Injectable()
export class DebtorExchangeService {
  constructor(
    private readonly scoped: TenantScopedService,
    private readonly tokens: DebtorTokenService,
    private readonly tracking: TrackingService,
    private readonly push: PushService,
  ) {}

  async exchange(rawToken: string, ip?: string): Promise<{ token: string }> {
    const tokenHash = hashAccessToken(rawToken);
    const access = await this.scoped.raw().debtorAccess.findUnique({ where: { tokenHash } });
    if (!access || !access.active) throw new UnauthorizedException('Link inválido');
    // Devedor de carteira suspensa/não aprovada NÃO recebe sessão (antes, seguia operando).
    const tenant = await this.scoped.raw().tenant.findUnique({ where: { id: access.tenantId }, select: { status: true, approval: true } });
    if (!tenant || tenant.status !== 'ACTIVE' || tenant.approval !== 'APPROVED') {
      throw new UnauthorizedException('Acesso indisponível no momento. Fale com seu padrinho.');
    }
    const firstAccessName = await this.scoped.withTenant(access.tenantId, async (tx) => {
      // Primeiro acesso = ainda não havia login bem-sucedido antes deste.
      const priorLogins = await tx.debtorLoginEvent.count({ where: { debtorId: access.debtorId, tenantId: access.tenantId, success: true } });
      await tx.debtorAccess.updateMany({ where: { debtorId: access.debtorId, tenantId: access.tenantId }, data: { lastSeenAt: new Date() } });
      await tx.debtorLoginEvent.create({ data: { debtorId: access.debtorId, tenantId: access.tenantId, success: true, ip: ip ?? null } });
      // Uso de link (magic link) — alimenta o feed de atividade do super-admin.
      await this.tracking.record(tx, { tenantId: access.tenantId, actorType: 'DEBTOR', actorId: access.debtorId, type: 'LINK_USED', targetType: 'debtorAccess', targetId: access.id, ip: ip ?? null });
      if (priorLogins > 0) return null;
      const d = await tx.debtor.findUnique({ where: { id: access.debtorId }, select: { name: true } });
      const nm = d?.name ?? 'Seu sobrinho';
      await notifyCreditor(tx, { tenantId: access.tenantId, debtorId: access.debtorId, type: 'DEBTOR_FIRST_ACCESS', title: 'Primeiro acesso', body: `${nm} abriu o link pela primeira vez.` });
      return nm;
    });
    // Primeiro acesso → push imediato ao telefone do padrinho (fora da tx; no-op sem VAPID).
    if (firstAccessName) {
      void this.push.notifyImportant(access.tenantId, 'DEBTOR_FIRST_ACCESS', firstAccessName).catch(() => undefined);
    }
    return { token: this.tokens.sign({ debtorId: access.debtorId, tenantId: access.tenantId, accessVersion: access.rotatedAt?.getTime() ?? 0 }) };
  }
}

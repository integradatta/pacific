import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantDatasourceResolver } from '../tenancy/tenant-datasource.resolver.js';

interface Identity { supabaseId: string; email: string; }

@Injectable()
export class RedeemService {
  constructor(private readonly resolver: TenantDatasourceResolver) {}

  async redeem(identity: Identity, orgCode: string): Promise<{ tenantId: string }> {
    const db = this.resolver.forTenant('__redeem__');

    // Idempotência: usuário já vinculado.
    const existing = await db.user.findUnique({ where: { supabaseId: identity.supabaseId } });
    if (existing?.tenantId) return { tenantId: existing.tenantId };

    // Erro genérico para código inválido OU tenant inativo (não revela qual).
    const tenant = await db.tenant.findUnique({ where: { orgCode } });
    if (!tenant || tenant.status !== 'ACTIVE') throw new NotFoundException('Código inválido');

    const user = await db.user.create({
      data: { supabaseId: identity.supabaseId, email: identity.email, role: 'DEBTOR', tenantId: tenant.id },
    });

    // Fluxo oficial simplificado: baseado apenas no org_code. Sempre cria o devedor.
    await db.debtor.create({
      data: { tenantId: tenant.id, userId: user.id, name: identity.email, email: identity.email, redeemedAt: new Date() },
    });
    return { tenantId: tenant.id };
  }
}

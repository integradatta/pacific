import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';

interface Identity { supabaseId: string; email: string; }

@Injectable()
export class RedeemService {
  constructor(private readonly scoped: TenantScopedService) {}

  async redeem(identity: Identity, orgCode: string): Promise<{ tenantId: string }> {
    const base = this.scoped.raw();

    // Idempotência: usuário já vinculado (User/Tenant não estão sob RLS — lookups globais).
    const existing = await base.user.findUnique({ where: { supabaseId: identity.supabaseId } });
    if (existing?.tenantId) return { tenantId: existing.tenantId };

    // Erro genérico para código inválido OU tenant inativo (não revela qual).
    const tenant = await base.tenant.findUnique({ where: { orgCode } });
    if (!tenant || tenant.status !== 'ACTIVE') throw new NotFoundException('Código inválido');

    // Escritas com contexto de tenant: a inserção em Debtor passa pela WITH CHECK da RLS.
    return this.scoped.withTenant(tenant.id, async (tx) => {
      const user = await tx.user.create({
        data: { supabaseId: identity.supabaseId, email: identity.email, role: 'DEBTOR', tenantId: tenant.id },
      });
      await tx.debtor.create({
        data: { tenantId: tenant.id, userId: user.id, name: identity.email, email: identity.email, redeemedAt: new Date() },
      });
      return { tenantId: tenant.id };
    });
  }
}

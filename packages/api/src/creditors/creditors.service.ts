import { ConflictException, Injectable } from '@nestjs/common';
import { generateUniqueOrgCode } from '@pacific/shared';
import { TenantDatasourceResolver } from '../tenancy/tenant-datasource.resolver.js';

// supabaseId/email vêm do JWT verificado (controller), nunca do corpo da requisição.
export interface RegisterCreditorInput {
  orgName: string;
  supabaseId: string;
  email: string;
}

@Injectable()
export class CreditorsService {
  constructor(private readonly resolver: TenantDatasourceResolver) {}
  async register(input: RegisterCreditorInput): Promise<{ tenantId: string; orgCode: string }> {
    const db = this.resolver.forTenant('__provisioning__');

    // Idempotente: se este usuário já tem carteira, devolve a existente.
    // Recupera contas "órfãs" (usuário no Supabase sem tenant) e torna seguro re-chamar.
    const existing = await db.user.findUnique({ where: { supabaseId: input.supabaseId } });
    if (existing?.tenantId) return this.tenantResult(db, existing.tenantId);

    const orgCode = await generateUniqueOrgCode(
      async (code) => (await db.tenant.findUnique({ where: { orgCode: code } })) !== null,
    );
    // Transacional: evita tenant órfão se o user.create falhar (ex.: supabaseId duplicado).
    try {
      return await db.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({ data: { name: input.orgName, orgCode } });
        await tx.user.create({
          data: { supabaseId: input.supabaseId, email: input.email, role: 'CREDITOR', tenantId: tenant.id },
        });
        return { tenantId: tenant.id, orgCode };
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') {
        // Corrida: outro request criou a conta entre o findUnique e o create -> devolve a existente.
        const raced = await db.user.findUnique({ where: { supabaseId: input.supabaseId } });
        if (raced?.tenantId) return this.tenantResult(db, raced.tenantId);
        throw new ConflictException('Conta já registrada');
      }
      throw e;
    }
  }

  private async tenantResult(
    db: ReturnType<TenantDatasourceResolver['forTenant']>,
    tenantId: string,
  ): Promise<{ tenantId: string; orgCode: string }> {
    const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
    return { tenantId, orgCode: tenant?.orgCode ?? '' };
  }
}

import { Injectable } from '@nestjs/common';
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
    const orgCode = await generateUniqueOrgCode(
      async (code) => (await db.tenant.findUnique({ where: { orgCode: code } })) !== null,
    );
    const tenant = await db.tenant.create({ data: { name: input.orgName, orgCode } });
    await db.user.create({
      data: { supabaseId: input.supabaseId, email: input.email, role: 'CREDITOR', tenantId: tenant.id },
    });
    return { tenantId: tenant.id, orgCode };
  }
}

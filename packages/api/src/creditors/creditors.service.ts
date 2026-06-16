import { Injectable } from '@nestjs/common';
import { generateUniqueOrgCode } from '@pacific/shared';
import { TenantDatasourceResolver } from '../tenancy/tenant-datasource.resolver.js';
import type { RegisterCreditorDto } from './dto/register-creditor.dto.js';

@Injectable()
export class CreditorsService {
  constructor(private readonly resolver: TenantDatasourceResolver) {}
  async register(dto: RegisterCreditorDto): Promise<{ tenantId: string; orgCode: string }> {
    const db = this.resolver.forTenant('__provisioning__');
    const orgCode = await generateUniqueOrgCode(
      async (code) => (await db.tenant.findUnique({ where: { orgCode: code } })) !== null,
    );
    const tenant = await db.tenant.create({ data: { name: dto.orgName, orgCode } });
    await db.user.create({
      data: { supabaseId: dto.supabaseId, email: dto.email, role: 'CREDITOR', tenantId: tenant.id },
    });
    return { tenantId: tenant.id, orgCode };
  }
}

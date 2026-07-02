import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard.js';
import { PrincipalGuard } from '../auth/principal.guard.js';
import { TenantGuard } from '../tenancy/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { TenantId } from '../tenancy/tenant-id.decorator.js';
import { InsightsService } from './insights.service.js';
import type { DebtorProfile } from '@pacific/shared';

@Controller('insights')
@UseGuards(new JwtGuard(), PrincipalGuard, TenantGuard, RolesGuard)
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get('debtors/:id/profile') @Roles('CREDITOR')
  debtorProfile(@TenantId() tenantId: string, @Param('id') id: string): Promise<DebtorProfile> {
    return this.insights.debtorProfile(tenantId, id);
  }
}

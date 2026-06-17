import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard.js';
import { TenantGuard } from '../tenancy/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { TenantId } from '../tenancy/tenant-id.decorator.js';
import { DashboardService } from './dashboard.service.js';
import type { DashboardKpis } from '@pacific/shared';

@Controller('dashboard')
@UseGuards(new JwtGuard(), TenantGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('kpis') @Roles('CREDITOR')
  kpis(@TenantId() tenantId: string): Promise<DashboardKpis> {
    return this.dashboard.kpis(tenantId);
  }
}

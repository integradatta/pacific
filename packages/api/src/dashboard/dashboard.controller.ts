import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard.js';
import { TenantGuard } from '../tenancy/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PrincipalGuard } from '../auth/principal.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { TenantId } from '../tenancy/tenant-id.decorator.js';
import { DashboardService } from './dashboard.service.js';
import { normalizeThresholds, type DashboardKpis, type PortfolioRow, type PortfolioIntelligence } from '@pacific/shared';

const num = (v: string | undefined): number | undefined => (v == null || v === '' ? undefined : Number(v));

@Controller('dashboard')
@UseGuards(new JwtGuard(), PrincipalGuard, TenantGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('kpis') @Roles('CREDITOR')
  kpis(@TenantId() tenantId: string): Promise<DashboardKpis> {
    return this.dashboard.kpis(tenantId);
  }

  @Get('portfolio') @Roles('CREDITOR')
  portfolio(@TenantId() tenantId: string): Promise<PortfolioRow[]> {
    return this.dashboard.portfolio(tenantId);
  }

  @Get('intelligence') @Roles('CREDITOR')
  intelligence(
    @TenantId() tenantId: string,
    @Query('highRiskBelow') highRiskBelow?: string,
    @Query('concentrationLimitPct') concentrationLimitPct?: string,
    @Query('dueSoonDays') dueSoonDays?: string,
  ): Promise<PortfolioIntelligence> {
    // Limiares configuráveis pelo credor (query); sanitizados p/ faixas seguras.
    const thresholds = normalizeThresholds({ highRiskBelow: num(highRiskBelow), concentrationLimitPct: num(concentrationLimitPct), dueSoonDays: num(dueSoonDays) });
    return this.dashboard.intelligence(tenantId, undefined, thresholds);
  }
}

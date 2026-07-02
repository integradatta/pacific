import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { JwtGuard } from '../auth/jwt.guard.js';
import { PrincipalGuard } from '../auth/principal.guard.js';
import { TenantGuard } from '../tenancy/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { TenantId } from '../tenancy/tenant-id.decorator.js';
import { InsightsService, type DebtorSignalRow, type CoolingRow, type SimulationResult } from './insights.service.js';
import type { DebtorProfile, CashForecast } from '@pacific/shared';

export class SimulateDto {
  @IsNumber() @Min(0) amount!: number;
  @IsOptional() @IsString() debtorId?: string;
}

@Controller('insights')
@UseGuards(new JwtGuard(), PrincipalGuard, TenantGuard, RolesGuard)
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get('debtors/:id/profile') @Roles('CREDITOR')
  debtorProfile(@TenantId() tenantId: string, @Param('id') id: string): Promise<DebtorProfile> {
    return this.insights.debtorProfile(tenantId, id);
  }

  @Get('cash-forecast') @Roles('CREDITOR')
  cashForecast(@TenantId() tenantId: string): Promise<CashForecast> {
    return this.insights.cashForecast(tenantId);
  }

  @Get('radar') @Roles('CREDITOR')
  radar(@TenantId() tenantId: string): Promise<CoolingRow[]> {
    return this.insights.coolingRadar(tenantId);
  }

  @Post('simulate') @Roles('CREDITOR')
  simulate(@TenantId() tenantId: string, @Body() dto: SimulateDto): Promise<SimulationResult> {
    return this.insights.simulate(tenantId, { amount: dto.amount, debtorId: dto.debtorId });
  }

  @Get('debtors/:id/signals') @Roles('CREDITOR')
  openSignals(@TenantId() tenantId: string, @Param('id') id: string): Promise<DebtorSignalRow[]> {
    return this.insights.openSignals(tenantId, id);
  }

  @Post('signals/:id/resolve') @Roles('CREDITOR')
  resolveSignal(@TenantId() tenantId: string, @Param('id') id: string): Promise<void> {
    return this.insights.resolveSignal(tenantId, id);
  }
}

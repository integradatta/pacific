import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsNumber, IsNumberString, IsOptional, IsString, Min } from 'class-validator';
import { JwtGuard } from '../auth/jwt.guard.js';
import { PrincipalGuard } from '../auth/principal.guard.js';
import { TenantGuard } from '../tenancy/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { TenantId } from '../tenancy/tenant-id.decorator.js';
import { InsightsService, type DebtorSignalRow, type CoolingRow, type SimulationResult, type Suggestion, type RenegotiationEfficacy, type BenchmarkResult } from './insights.service.js';
import { PromisesService, type PromiseRow } from './promises.service.js';
import { ForecastService, type ForecastPoint } from './forecast.service.js';
import type { DebtorProfile, CashForecast, PricingHistory } from '@pacific/shared';

export class SimulateDto {
  @IsNumber() @Min(0) amount!: number;
  @IsOptional() @IsString() debtorId?: string;
}

export class CreatePromiseDto {
  @IsString() debtId!: string;
  @IsString() promisedAt!: string; // ISO
  @IsOptional() @IsNumberString() amount?: string;
  @IsOptional() @IsString() note?: string;
}

@Controller('insights')
@UseGuards(new JwtGuard(), PrincipalGuard, TenantGuard, RolesGuard)
export class InsightsController {
  constructor(
    private readonly insights: InsightsService,
    private readonly promises: PromisesService,
    private readonly forecast: ForecastService,
  ) {}

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

  @Get('suggestions') @Roles('CREDITOR')
  suggestions(@TenantId() tenantId: string): Promise<Suggestion[]> {
    return this.insights.suggestions(tenantId);
  }

  @Post('simulate') @Roles('CREDITOR')
  simulate(@TenantId() tenantId: string, @Body() dto: SimulateDto): Promise<SimulationResult> {
    return this.insights.simulate(tenantId, { amount: dto.amount, debtorId: dto.debtorId });
  }

  @Get('pricing') @Roles('CREDITOR')
  pricing(@TenantId() tenantId: string): Promise<PricingHistory> {
    return this.insights.pricingHistory(tenantId);
  }

  @Get('renegotiation') @Roles('CREDITOR')
  renegotiation(@TenantId() tenantId: string): Promise<RenegotiationEfficacy> {
    return this.insights.renegotiationEfficacy(tenantId);
  }

  @Get('forecast-accuracy') @Roles('CREDITOR')
  forecastAccuracy(@TenantId() tenantId: string): Promise<ForecastPoint[]> {
    return this.forecast.accuracy(tenantId);
  }

  @Get('benchmark') @Roles('CREDITOR')
  benchmark(@TenantId() tenantId: string): Promise<BenchmarkResult> {
    return this.insights.benchmark(tenantId);
  }

  @Get('debtors/:id/signals') @Roles('CREDITOR')
  openSignals(@TenantId() tenantId: string, @Param('id') id: string): Promise<DebtorSignalRow[]> {
    return this.insights.openSignals(tenantId, id);
  }

  @Post('signals/:id/resolve') @Roles('CREDITOR')
  resolveSignal(@TenantId() tenantId: string, @Param('id') id: string): Promise<void> {
    return this.insights.resolveSignal(tenantId, id);
  }

  // #4 Promessas rastreadas
  @Get('debtors/:id/promises') @Roles('CREDITOR')
  promisesForDebtor(@TenantId() tenantId: string, @Param('id') id: string): Promise<PromiseRow[]> {
    return this.promises.listForDebtor(tenantId, id);
  }

  @Post('promises') @Roles('CREDITOR')
  createPromise(@TenantId() tenantId: string, @Body() dto: CreatePromiseDto): Promise<PromiseRow> {
    return this.promises.create(tenantId, { debtId: dto.debtId, promisedAt: dto.promisedAt, amount: dto.amount, note: dto.note });
  }

  @Delete('promises/:id') @Roles('CREDITOR')
  removePromise(@TenantId() tenantId: string, @Param('id') id: string): Promise<void> {
    return this.promises.remove(tenantId, id);
  }
}

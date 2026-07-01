import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard.js';
import { PrincipalGuard } from '../auth/principal.guard.js';
import { TenantGuard } from '../tenancy/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { TenantId } from '../tenancy/tenant-id.decorator.js';
import { ReportsService, monthKey, type MonthlyReportRow } from './reports.service.js';

// REL-1 — Relatórios mensais (in-app). Lista o histórico; gera o mês atual sob demanda.
@Controller('reports')
@UseGuards(new JwtGuard(), PrincipalGuard, TenantGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get() @Roles('CREDITOR')
  list(@TenantId() tenantId: string): Promise<MonthlyReportRow[]> {
    return this.reports.list(tenantId);
  }

  @Post('generate') @Roles('CREDITOR')
  generate(@TenantId() tenantId: string): Promise<MonthlyReportRow> {
    return this.reports.generate(tenantId, monthKey(new Date()));
  }
}

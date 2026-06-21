import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard.js';
import { TenantGuard } from '../tenancy/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PrincipalGuard } from '../auth/principal.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { TenantId } from '../tenancy/tenant-id.decorator.js';
import { PaginationQuery, Page } from '../common/pagination.js';
import { DebtsService } from './debts.service.js';
import { CreateDebtDto } from './dto/create-debt.dto.js';
import { CreateQuickDebtDto } from './dto/create-quick-debt.dto.js';
import { UpdateDebtTagsDto } from './dto/update-debt-tags.dto.js';
import type { Debt } from '@pacific/database';
import type { DebtSummary, DebtRecord, DebtEvent } from '@pacific/shared';

@Controller('debts')
@UseGuards(new JwtGuard(), PrincipalGuard, TenantGuard, RolesGuard)
export class DebtsController {
  constructor(private readonly debts: DebtsService) {}

  @Post() @Roles('CREDITOR')
  create(@TenantId() tenantId: string, @Body() dto: CreateDebtDto): Promise<Debt> {
    return this.debts.create(tenantId, dto);
  }

  // Cadastro simplificado: cria cliente + operação numa transação.
  @Post('quick') @Roles('CREDITOR')
  createQuick(
    @TenantId() tenantId: string,
    @Body() dto: CreateQuickDebtDto,
  ): Promise<{ debtorId: string; debtId: string }> {
    return this.debts.createQuick(tenantId, dto);
  }

  @Get() @Roles('CREDITOR')
  list(@TenantId() tenantId: string, @Query() q: PaginationQuery): Promise<Page<Debt>> {
    return this.debts.list(tenantId, q);
  }

  @Get(':id') @Roles('CREDITOR')
  get(@TenantId() tenantId: string, @Param('id') id: string): Promise<DebtRecord> {
    return this.debts.get(tenantId, id);
  }

  @Get(':id/summary') @Roles('CREDITOR')
  summary(@TenantId() tenantId: string, @Param('id') id: string): Promise<DebtSummary> {
    return this.debts.summary(tenantId, id);
  }

  @Get(':id/history') @Roles('CREDITOR')
  history(@TenantId() tenantId: string, @Param('id') id: string): Promise<DebtEvent[]> {
    return this.debts.history(tenantId, id);
  }

  @Patch(':id/tags') @Roles('CREDITOR')
  setTags(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDebtTagsDto,
  ): Promise<DebtRecord> {
    return this.debts.setTags(tenantId, id, dto.tags);
  }
}

import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard.js';
import { TenantGuard } from '../tenancy/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { TenantId } from '../tenancy/tenant-id.decorator.js';
import { PaginationQuery, Page } from '../common/pagination.js';
import { DebtsService } from './debts.service.js';
import { CreateDebtDto } from './dto/create-debt.dto.js';
import type { Debt } from '@pacific/database';

@Controller('debts')
@UseGuards(new JwtGuard(), TenantGuard, RolesGuard)
export class DebtsController {
  constructor(private readonly debts: DebtsService) {}

  @Post() @Roles('CREDITOR')
  create(@TenantId() tenantId: string, @Body() dto: CreateDebtDto): Promise<Debt> {
    return this.debts.create(tenantId, dto);
  }

  @Get() @Roles('CREDITOR')
  list(@TenantId() tenantId: string, @Query() q: PaginationQuery): Promise<Page<Debt>> {
    return this.debts.list(tenantId, q);
  }

  @Get(':id') @Roles('CREDITOR')
  get(@TenantId() tenantId: string, @Param('id') id: string): Promise<Debt> {
    return this.debts.get(tenantId, id);
  }
}

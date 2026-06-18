import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard.js';
import { TenantGuard } from '../tenancy/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { TenantId } from '../tenancy/tenant-id.decorator.js';
import { PaginationQuery } from '../common/pagination.js';
import { DebtorsAdminService } from './debtors-admin.service.js';
import { CreateDebtorDto } from './dto/create-debtor.dto.js';

@Controller('debtors')
@UseGuards(new JwtGuard(), TenantGuard, RolesGuard)
export class DebtorProvisioningController {
  constructor(private readonly debtors: DebtorsAdminService) {}

  @Post() @Roles('CREDITOR')
  create(@TenantId() tenantId: string, @Body() dto: CreateDebtorDto) {
    return this.debtors.create(tenantId, dto.name);
  }

  @Get() @Roles('CREDITOR')
  list(@TenantId() tenantId: string, @Query() q: PaginationQuery) {
    return this.debtors.list(tenantId, q);
  }

  @Post(':id/revoke') @Roles('CREDITOR')
  revoke(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.debtors.setActive(tenantId, id, false);
  }

  @Post(':id/reactivate') @Roles('CREDITOR')
  reactivate(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.debtors.setActive(tenantId, id, true);
  }

  @Post(':id/rotate-link') @Roles('CREDITOR')
  rotate(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.debtors.rotateLink(tenantId, id);
  }

  @Get(':id/logins') @Roles('CREDITOR')
  logins(@TenantId() tenantId: string, @Param('id') id: string, @Query() q: PaginationQuery) {
    return this.debtors.logins(tenantId, id, q);
  }
}

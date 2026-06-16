import { Module } from '@nestjs/common';
import { PrismaService } from './common/prisma.service.js';
import { TenantDatasourceResolver } from './tenancy/tenant-datasource.resolver.js';
import { TenantScopedService } from './tenancy/tenant-scoped.service.js';
import { CreditorsService } from './creditors/creditors.service.js';
import { CreditorsController } from './creditors/creditors.controller.js';
import { RedeemService } from './debtors/redeem.service.js';
import { DebtorsController } from './debtors/debtors.controller.js';

@Module({
  controllers: [CreditorsController, DebtorsController],
  providers: [PrismaService, TenantDatasourceResolver, TenantScopedService, CreditorsService, RedeemService],
  exports: [PrismaService],
})
export class AppModule {}

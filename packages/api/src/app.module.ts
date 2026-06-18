import { Module } from '@nestjs/common';
import { PrismaService } from './common/prisma.service.js';
import { TenantDatasourceResolver } from './tenancy/tenant-datasource.resolver.js';
import { TenantScopedService } from './tenancy/tenant-scoped.service.js';
import { CreditorsService } from './creditors/creditors.service.js';
import { CreditorsController } from './creditors/creditors.controller.js';
import { DebtorProvisioningController } from './debtors/debtor-provisioning.controller.js';
import { DebtorsAdminService } from './debtors/debtors-admin.service.js';
import { DebtsController } from './debts/debts.controller.js';
import { DebtsService } from './debts/debts.service.js';
import { DashboardController } from './dashboard/dashboard.controller.js';
import { DashboardService } from './dashboard/dashboard.service.js';
import { NotificationsController } from './notifications/notifications.controller.js';
import { NotificationsService } from './notifications/notifications.service.js';
import { DebtorExchangeController } from './auth/debtor-exchange.controller.js';
import { DebtorExchangeService } from './auth/debtor-exchange.service.js';
import { DebtorTokenService } from './auth/debtor-token.service.js';

@Module({
  controllers: [CreditorsController, DebtorProvisioningController, DebtsController, DashboardController, NotificationsController, DebtorExchangeController],
  providers: [PrismaService, TenantDatasourceResolver, TenantScopedService, CreditorsService, DebtorsAdminService, DebtsService, DashboardService, NotificationsService, DebtorExchangeService, DebtorTokenService],
  exports: [PrismaService],
})
export class AppModule {}

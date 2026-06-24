import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AllExceptionsFilter } from './common/http-exception.filter.js';
import { LoggingInterceptor } from './common/logging.interceptor.js';
import { HealthController } from './common/health.controller.js';
import { RetentionScheduler } from './common/retention.scheduler.js';
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
import { NotificationsScheduler } from './notifications/notifications.scheduler.js';
import { DebtorExchangeController } from './auth/debtor-exchange.controller.js';
import { DebtorExchangeService } from './auth/debtor-exchange.service.js';
import { DebtorTokenService } from './auth/debtor-token.service.js';
import { DebtorSelfController } from './debtors/debtor-self.controller.js';
import { DebtorSelfService } from './debtors/debtor-self.service.js';
import { SuperAdminController } from './admin/super-admin.controller.js';
import { SuperAdminService } from './admin/super-admin.service.js';
import { AUTH_ADMIN, createAuthAdmin } from './admin/auth-admin.js';
import { TrackingService } from './tracking/tracking.service.js';
import { EventsController, PublicEventsController } from './tracking/events.controller.js';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [HealthController, CreditorsController, DebtorProvisioningController, DebtsController, DashboardController, NotificationsController, DebtorExchangeController, DebtorSelfController, SuperAdminController, EventsController, PublicEventsController],
  providers: [PrismaService, TenantDatasourceResolver, TenantScopedService, CreditorsService, DebtorsAdminService, DebtsService, DashboardService, NotificationsService, NotificationsScheduler, RetentionScheduler, DebtorExchangeService, DebtorTokenService, DebtorSelfService, SuperAdminService, TrackingService, { provide: AUTH_ADMIN, useFactory: createAuthAdmin }, { provide: APP_FILTER, useClass: AllExceptionsFilter }, { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor }],
  exports: [PrismaService],
})
export class AppModule {}

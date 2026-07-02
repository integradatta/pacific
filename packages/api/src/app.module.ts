import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { getRedis } from './common/redis.js';
import { AllExceptionsFilter } from './common/http-exception.filter.js';
import { LoggingInterceptor } from './common/logging.interceptor.js';
import { HealthController } from './common/health.controller.js';
import { RetentionScheduler } from './common/retention.scheduler.js';
import { RlsHealthCheck } from './common/rls-healthcheck.service.js';
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
import { WeeklyDigestScheduler } from './notifications/weekly-digest.scheduler.js';
import { DebtorExchangeController } from './auth/debtor-exchange.controller.js';
import { DebtorExchangeService } from './auth/debtor-exchange.service.js';
import { DebtorTokenService } from './auth/debtor-token.service.js';
import { DebtorSelfController } from './debtors/debtor-self.controller.js';
import { DebtorSelfService } from './debtors/debtor-self.service.js';
import { SuperAdminController } from './admin/super-admin.controller.js';
import { SuperAdminService } from './admin/super-admin.service.js';
import { StatsScheduler } from './admin/stats.scheduler.js';
import { AUTH_ADMIN, createAuthAdmin } from './admin/auth-admin.js';
import { TrackingService } from './tracking/tracking.service.js';
import { EventsController, PublicEventsController } from './tracking/events.controller.js';
import { DebtorGuard } from './auth/debtor.guard.js';
import { InsightsService } from './insights/insights.service.js';
import { InsightsController } from './insights/insights.controller.js';
import { LocationService } from './location/location.service.js';
import { LocationController } from './location/location.controller.js';
import { LocationDebtorController } from './location/location-debtor.controller.js';
import { ReportsService } from './reports/reports.service.js';
import { ReportsScheduler } from './reports/reports.scheduler.js';
import { ReportsController } from './reports/reports.controller.js';

// A1 — Storage do rate limit: Redis (correto entre réplicas) quando REDIS_URL existe; senão in-memory.
const _redis = getRedis();
const throttlerStorage = _redis ? new ThrottlerStorageRedisService(_redis) : undefined;

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // Rate limiting global (anti-scraping/brute) por IP/janela. Com REDIS_URL, o storage é Redis
    // (limite correto entre réplicas); sem ele, in-memory (1 réplica). Configurável por env.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: Number(process.env.THROTTLE_TTL_MS ?? 60_000), limit: Number(process.env.THROTTLE_LIMIT ?? 300) }],
      ...(throttlerStorage ? { storage: throttlerStorage } : {}),
    }),
  ],
  controllers: [HealthController, CreditorsController, DebtorProvisioningController, DebtsController, DashboardController, NotificationsController, DebtorExchangeController, DebtorSelfController, SuperAdminController, EventsController, PublicEventsController, LocationController, LocationDebtorController, ReportsController, InsightsController],
  providers: [PrismaService, TenantDatasourceResolver, TenantScopedService, CreditorsService, DebtorsAdminService, DebtsService, DashboardService, NotificationsService, NotificationsScheduler, WeeklyDigestScheduler, RetentionScheduler, RlsHealthCheck, DebtorExchangeService, DebtorTokenService, DebtorSelfService, SuperAdminService, StatsScheduler, TrackingService, LocationService, ReportsService, ReportsScheduler, DebtorGuard, InsightsService, { provide: AUTH_ADMIN, useFactory: createAuthAdmin }, { provide: APP_FILTER, useClass: AllExceptionsFilter }, { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor }, { provide: APP_GUARD, useClass: ThrottlerGuard }],
  exports: [PrismaService],
})
export class AppModule {}

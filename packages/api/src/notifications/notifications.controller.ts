import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard.js';
import { TenantGuard } from '../tenancy/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PrincipalGuard } from '../auth/principal.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { TenantId } from '../tenancy/tenant-id.decorator.js';
import { PaginationQuery, Page } from '../common/pagination.js';
import { NotificationsService } from './notifications.service.js';
import { GenerateAlertsDto } from './dto/generate-alerts.dto.js';
import type { Notification } from '@pacific/database';

@Controller('notifications')
@UseGuards(new JwtGuard(), PrincipalGuard, TenantGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get() @Roles('CREDITOR')
  list(@TenantId() tenantId: string, @Query() q: PaginationQuery): Promise<Page<Notification>> {
    return this.notifications.list(tenantId, q);
  }

  @Post('generate') @Roles('CREDITOR')
  generate(@TenantId() tenantId: string, @Body() dto: GenerateAlertsDto): Promise<{ created: number }> {
    return this.notifications.generateDueNotifications(tenantId, dto.types);
  }

  // Gera o resumo semanal AGORA (força; ignora o dedup semanal) — útil para testar sob demanda.
  // Só cria se o padrinho tiver optado por receber (weeklyDigestOptIn).
  @Post('weekly-digest') @Roles('CREDITOR')
  weeklyDigest(@TenantId() tenantId: string): Promise<{ created: number }> {
    return this.notifications.generateWeeklyDigest(tenantId, { force: true });
  }

  @Patch(':id/read') @Roles('CREDITOR')
  read(@TenantId() tenantId: string, @Param('id') id: string): Promise<Notification> {
    return this.notifications.markRead(tenantId, id);
  }
}

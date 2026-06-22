import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { JwtGuard } from '../auth/jwt.guard.js';
import { PrincipalGuard } from '../auth/principal.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser, AdminAccessLinkRow, AdminAuditEntry, AdminCreditorRow, AdminEventRow, AdminOverview, AdminTenantRow, AdminUserRow, ActorType, PlatformEventType, TenantApproval } from '@pacific/shared';
import { SuperAdminService, type Actor } from './super-admin.service.js';
import { TrackingService } from '../tracking/tracking.service.js';

const actorOf = (u: AuthUser): Actor => ({ supabaseId: u.supabaseId, email: u.email });

export class DeleteTenantDto {
  @IsString() confirmOrgCode!: string;
}

// Painel do administrador máximo. Só SUPER_ADMIN. Cross-tenant.
@Controller('admin')
@UseGuards(new JwtGuard(), PrincipalGuard, RolesGuard)
export class SuperAdminController {
  constructor(
    private readonly admin: SuperAdminService,
    private readonly tracking: TrackingService,
  ) {}

  @Get('events') @Roles('SUPER_ADMIN')
  events(
    @Query('type') type?: PlatformEventType,
    @Query('actorType') actorType?: ActorType,
    @Query('tenantId') tenantId?: string,
    @Query('limit') limit?: string,
  ): Promise<AdminEventRow[]> {
    return this.tracking.list({ type, actorType, tenantId, limit: limit ? Number(limit) : undefined });
  }

  @Get('overview') @Roles('SUPER_ADMIN')
  overview(): Promise<AdminOverview> {
    return this.admin.overview();
  }

  @Get('creditors') @Roles('SUPER_ADMIN')
  creditors(): Promise<AdminCreditorRow[]> {
    return this.admin.creditors();
  }

  @Get('access-links') @Roles('SUPER_ADMIN')
  accessLinks(@Query('limit') limit?: string): Promise<AdminAccessLinkRow[]> {
    return this.admin.accessLinks(limit ? Number(limit) : undefined);
  }

  @Post('access-links/:id/revoke') @Roles('SUPER_ADMIN')
  revokeLink(@CurrentUser() u: AuthUser, @Param('id') id: string): Promise<void> {
    return this.admin.revokeLink(actorOf(u), id);
  }

  @Get('tenants') @Roles('SUPER_ADMIN')
  tenants(@Query('approval') approval?: TenantApproval): Promise<AdminTenantRow[]> {
    return this.admin.listTenants(approval);
  }

  @Post('tenants/:id/approve') @Roles('SUPER_ADMIN')
  approve(@CurrentUser() u: AuthUser, @Param('id') id: string): Promise<void> {
    return this.admin.approveTenant(actorOf(u), id);
  }

  @Post('tenants/:id/reject') @Roles('SUPER_ADMIN')
  reject(@CurrentUser() u: AuthUser, @Param('id') id: string): Promise<void> {
    return this.admin.rejectTenant(actorOf(u), id);
  }

  @Post('tenants/:id/suspend') @Roles('SUPER_ADMIN')
  suspend(@CurrentUser() u: AuthUser, @Param('id') id: string): Promise<void> {
    return this.admin.suspendTenant(actorOf(u), id);
  }

  @Post('tenants/:id/reactivate') @Roles('SUPER_ADMIN')
  reactivate(@CurrentUser() u: AuthUser, @Param('id') id: string): Promise<void> {
    return this.admin.reactivateTenant(actorOf(u), id);
  }

  @Post('tenants/:id/block') @Roles('SUPER_ADMIN')
  block(@CurrentUser() u: AuthUser, @Param('id') id: string): Promise<void> {
    return this.admin.setCreditorBlocked(actorOf(u), id, true);
  }

  @Post('tenants/:id/unblock') @Roles('SUPER_ADMIN')
  unblock(@CurrentUser() u: AuthUser, @Param('id') id: string): Promise<void> {
    return this.admin.setCreditorBlocked(actorOf(u), id, false);
  }

  @Delete('tenants/:id') @Roles('SUPER_ADMIN')
  remove(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: DeleteTenantDto): Promise<void> {
    return this.admin.deleteTenant(actorOf(u), id, dto.confirmOrgCode);
  }

  @Get('tenants/:id/operations') @Roles('SUPER_ADMIN')
  operations(@Param('id') id: string) {
    return this.admin.tenantOperations(id);
  }

  @Post('users/:id/force-logout') @Roles('SUPER_ADMIN')
  forceLogout(@CurrentUser() u: AuthUser, @Param('id') id: string): Promise<void> {
    return this.admin.forceLogout(actorOf(u), id);
  }

  @Get('users') @Roles('SUPER_ADMIN')
  users(): Promise<AdminUserRow[]> {
    return this.admin.listUsers();
  }

  @Post('users/:id/password-reset') @Roles('SUPER_ADMIN')
  resetPassword(@CurrentUser() u: AuthUser, @Param('id') id: string): Promise<void> {
    return this.admin.requestPasswordReset(actorOf(u), id);
  }

  @Get('audit') @Roles('SUPER_ADMIN')
  audit(
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ): Promise<AdminAuditEntry[]> {
    return this.admin.auditLog({ action, from, to, limit: limit ? Number(limit) : undefined });
  }
}

import { Body, Controller, ForbiddenException, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard.js';
import { TenantGuard } from '../tenancy/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { TenantId } from '../tenancy/tenant-id.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser, LivePosition, LocationConsent } from '@pacific/shared';
import { LocationService } from './location.service.js';
import { SetConsentDto } from './dto/set-consent.dto.js';
import { PingDto } from './dto/ping.dto.js';

function parseHistory(from?: string, to?: string, limit?: string) {
  return {
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    limit: limit ? Number(limit) : undefined,
  };
}

@Controller('location')
@UseGuards(new JwtGuard(), TenantGuard, RolesGuard)
export class LocationController {
  constructor(private readonly location: LocationService) {}

  // ── Devedor (próprio): consentimento + envio da própria posição ──
  @Get('self/consent') @Roles('DEBTOR')
  myConsent(@TenantId() tenantId: string, @CurrentUser() user: AuthUser): Promise<LocationConsent> {
    return this.location.getConsent(tenantId, this.debtorId(user));
  }

  @Post('self/consent') @Roles('DEBTOR')
  setMyConsent(@TenantId() tenantId: string, @CurrentUser() user: AuthUser, @Body() dto: SetConsentDto): Promise<LocationConsent> {
    return this.location.setConsent(tenantId, this.debtorId(user), dto.granted);
  }

  @Post('self/ping') @Roles('DEBTOR')
  ping(@TenantId() tenantId: string, @CurrentUser() user: AuthUser, @Body() dto: PingDto): Promise<LivePosition> {
    return this.location.recordPing(tenantId, this.debtorId(user), dto);
  }

  @Get('self/history') @Roles('DEBTOR')
  myHistory(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ): Promise<LivePosition[]> {
    return this.location.history(tenantId, this.debtorId(user), parseHistory(from, to, limit));
  }

  // ── Credor (painel administrativo): só vê quem está compartilhando ──
  @Get('positions') @Roles('CREDITOR')
  positions(@TenantId() tenantId: string): Promise<LivePosition[]> {
    return this.location.positions(tenantId);
  }

  @Get(':debtorId/consent') @Roles('CREDITOR')
  consentOf(@TenantId() tenantId: string, @Param('debtorId') debtorId: string): Promise<LocationConsent> {
    return this.location.getConsent(tenantId, debtorId);
  }

  @Get(':debtorId/history') @Roles('CREDITOR')
  historyOf(
    @TenantId() tenantId: string,
    @Param('debtorId') debtorId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ): Promise<LivePosition[]> {
    return this.location.history(tenantId, debtorId, parseHistory(from, to, limit));
  }

  private debtorId(user: AuthUser): string {
    if (!user.debtorId) throw new ForbiddenException('Sessão de devedor inválida');
    return user.debtorId;
  }
}

import { Body, Controller, ForbiddenException, Get, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard.js';
import { TenantGuard } from '../tenancy/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { TenantId } from '../tenancy/tenant-id.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { LocationService, type ConsentState } from './location.service.js';
import { SetConsentDto, PingDto } from './dto/location.dto.js';
import type { AuthUser } from '@pacific/shared';

// Lado do SOBRINHO (auth = magic-link JWT). Compartilhamento de localização consentido.
@Controller('debtor/me/location')
@UseGuards(new JwtGuard(), TenantGuard, RolesGuard)
export class LocationDebtorController {
  constructor(private readonly location: LocationService) {}

  @Get('consent') @Roles('DEBTOR')
  getConsent(@TenantId() tenantId: string, @CurrentUser() user: AuthUser): Promise<{ state: ConsentState; updatedAt: string | null }> {
    if (!user.debtorId) throw new ForbiddenException('Sessão de devedor inválida');
    return this.location.getConsent(tenantId, user.debtorId);
  }

  @Post('consent') @Roles('DEBTOR')
  setConsent(@TenantId() tenantId: string, @CurrentUser() user: AuthUser, @Body() dto: SetConsentDto): Promise<{ state: ConsentState }> {
    if (!user.debtorId) throw new ForbiddenException('Sessão de devedor inválida');
    return this.location.setConsent(tenantId, user.debtorId, dto.state, dto.consentText);
  }

  @Post('ping') @Roles('DEBTOR')
  ping(@TenantId() tenantId: string, @CurrentUser() user: AuthUser, @Body() dto: PingDto): Promise<{ accepted: number }> {
    if (!user.debtorId) throw new ForbiddenException('Sessão de devedor inválida');
    return this.location.recordPings(tenantId, user.debtorId, dto.points);
  }
}

import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard.js';
import { PrincipalGuard } from '../auth/principal.guard.js';
import { TenantGuard } from '../tenancy/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { TenantId } from '../tenancy/tenant-id.decorator.js';
import { LocationService, type PanelPosition, type GeofenceRow } from './location.service.js';
import { GeofenceDto } from './dto/location.dto.js';

// Lado do PADRINHO (auth Supabase). Vê só devedores que consentiram (GRANTED).
@Controller('location')
@UseGuards(new JwtGuard(), PrincipalGuard, TenantGuard, RolesGuard)
export class LocationController {
  constructor(private readonly location: LocationService) {}

  @Get('positions') @Roles('CREDITOR')
  positions(@TenantId() tenantId: string): Promise<PanelPosition[]> {
    return this.location.positions(tenantId);
  }

  // Devedores que recusaram o compartilhamento (notificação ao padrinho).
  @Get('declines') @Roles('CREDITOR')
  declines(@TenantId() tenantId: string) {
    return this.location.declines(tenantId);
  }

  @Get('geofences') @Roles('CREDITOR')
  listGeofences(@TenantId() tenantId: string): Promise<GeofenceRow[]> {
    return this.location.listGeofences(tenantId);
  }

  @Post('geofences') @Roles('CREDITOR')
  createGeofence(@TenantId() tenantId: string, @Body() dto: GeofenceDto): Promise<GeofenceRow> {
    return this.location.createGeofence(tenantId, dto);
  }

  @Delete('geofences/:id') @Roles('CREDITOR')
  deleteGeofence(@TenantId() tenantId: string, @Param('id') id: string): Promise<void> {
    return this.location.deleteGeofence(tenantId, id);
  }

  @Get('debtors/:id/consent') @Roles('CREDITOR')
  consent(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.location.consentByDebtor(tenantId, id);
  }

  @Get('debtors/:id/history') @Roles('CREDITOR')
  history(@TenantId() tenantId: string, @Param('id') id: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.location.history(tenantId, id, from, to);
  }
}

import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/jwt-auth.guard.js';
import { RateLimitGuard } from '../../common/rate-limit.guard.js';
import { CurrentUser } from '../../common/decorators.js';
import type { Principal } from '../../common/principal.js';
import { GeofencingService } from './geofencing.service.js';
import { CreateGeofenceDto } from './dto/geofence.dto.js';

@Controller('api/v1')
@UseGuards(JwtAuthGuard, RateLimitGuard)
export class GeofencingController {
  constructor(private readonly geofencing: GeofencingService) {}

  @Get('groups/:id/geofences')
  list(@CurrentUser() p: Principal, @Param('id') id: string) {
    return this.geofencing.list(p, id);
  }

  @Post('groups/:id/geofences')
  create(@CurrentUser() p: Principal, @Param('id') id: string, @Body() dto: CreateGeofenceDto) {
    return this.geofencing.create(p, id, {
      name: dto.name,
      center: dto.center,
      radiusMeters: dto.radiusMeters,
      alertType: dto.alertType,
      monitoredMembers: dto.monitoredMembers,
      schedule: dto.schedule ?? null,
    });
  }

  @Delete('groups/:id/geofences/:geofenceId')
  remove(@CurrentUser() p: Principal, @Param('id') id: string, @Param('geofenceId') geofenceId: string) {
    return this.geofencing.remove(p, id, geofenceId);
  }
}

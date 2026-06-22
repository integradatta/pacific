import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/jwt-auth.guard.js';
import { RateLimitGuard, RateLimit } from '../../common/rate-limit.guard.js';
import { CurrentUser } from '../../common/decorators.js';
import type { Principal } from '../../common/principal.js';
import type { IncomingPoint } from '@pacific/geo-shared';
import { LocationsService } from './locations.service.js';
import { IngestLocationDto, BatchLocationDto, LocationPointDto } from './dto/location.dto.js';

function toPoint(d: LocationPointDto): IncomingPoint {
  return {
    lat: d.latitude,
    lng: d.longitude,
    accuracyMeters: d.accuracy_meters,
    altitudeMeters: d.altitude_meters ?? null,
    speedMps: d.speed_mps ?? null,
    headingDegrees: d.heading_degrees ?? null,
    batteryLevel: d.battery_level ?? null,
    source: d.source,
    recordedAt: d.timestamp,
  };
}

@Controller('api/v1')
@UseGuards(JwtAuthGuard, RateLimitGuard)
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Post('locations')
  @RateLimit({ limit: 5, windowMs: 60_000 })
  ingest(@CurrentUser() p: Principal, @Body() dto: IngestLocationDto) {
    return this.locations.ingest(p, dto.device_id, toPoint(dto));
  }

  @Post('locations/batch')
  @RateLimit({ limit: 1, windowMs: 5 * 60_000 })
  batch(@CurrentUser() p: Principal, @Body() dto: BatchLocationDto) {
    return this.locations.ingestBatch(p, dto.device_id, dto.points.map(toPoint));
  }

  @Get('groups/:id/locations/latest')
  latest(@CurrentUser() p: Principal, @Param('id') id: string) {
    return this.locations.latest(p, id);
  }

  @Get('groups/:id/locations')
  @RateLimit({ limit: 30, windowMs: 60_000 })
  history(
    @CurrentUser() p: Principal,
    @Param('id') id: string,
    @Query('user_id') userId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.locations.history(p, id, userId, { from, to, limit: limit ? Number(limit) : undefined });
  }
}

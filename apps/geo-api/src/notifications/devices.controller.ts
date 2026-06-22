import { Body, Controller, Inject, Injectable, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators.js';
import type { Principal } from '../common/principal.js';
import { GEO_DB, type GeoDb } from '../common/geo-db.js';

export class RegisterDeviceDto {
  @IsString() device_id!: string;
  @IsIn(['ios', 'android']) platform!: 'ios' | 'android';
  @IsOptional() @IsString() push_token?: string;
}

@Injectable()
export class DevicesService {
  constructor(@Inject(GEO_DB) private readonly db: GeoDb) {}
  register(p: Principal, dto: RegisterDeviceDto): Promise<void> {
    return this.db.withTenant(p.tenantId, async (q) => {
      await q.query(
        `INSERT INTO geo.user_device(user_id, tenant_id, device_id, platform, push_token, last_active_at, status)
         VALUES ($1,$2,$3,$4,$5, now(), 'active')
         ON CONFLICT (user_id, device_id)
         DO UPDATE SET push_token = EXCLUDED.push_token, platform = EXCLUDED.platform, last_active_at = now(), status = 'active'`,
        [p.userId, p.tenantId, dto.device_id, dto.platform, dto.push_token ?? null],
      );
    });
  }
}

@Controller('api/v1/devices')
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post()
  register(@CurrentUser() p: Principal, @Body() dto: RegisterDeviceDto) {
    return this.devices.register(p, dto);
  }
}

import { Body, Controller, Param, Put, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard.js';
import { RateLimitGuard } from '../../common/rate-limit.guard.js';
import { CurrentUser } from '../../common/decorators.js';
import type { Principal } from '../../common/principal.js';
import { SharingService } from './sharing.service.js';

export class SharingStatusDto {
  @IsIn(['pause', 'resume', 'revoke']) action!: 'pause' | 'resume' | 'revoke';
}

@Controller('api/v1')
@UseGuards(JwtAuthGuard, RateLimitGuard)
export class SharingController {
  constructor(private readonly sharing: SharingService) {}

  @Put('groups/:id/sharing-status')
  setStatus(@CurrentUser() p: Principal, @Param('id') id: string, @Body() dto: SharingStatusDto) {
    return this.sharing.setOwnSharing(p, id, dto.action);
  }
}

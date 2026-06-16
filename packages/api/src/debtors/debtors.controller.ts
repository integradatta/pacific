import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { RedeemRateLimitGuard } from './redeem-rate-limit.guard.js';
import { RedeemService } from './redeem.service.js';
import { RedeemDto } from './dto/redeem.dto.js';
import type { AuthUser } from '@pacific/shared';

@Controller('auth')
export class DebtorsController {
  constructor(private readonly redeem: RedeemService) {}
  @Post('redeem')
  @UseGuards(new JwtGuard(), new RedeemRateLimitGuard())
  do(@CurrentUser() user: AuthUser, @Body() dto: RedeemDto): Promise<{ tenantId: string }> {
    return this.redeem.redeem({ supabaseId: user.supabaseId, email: user.email }, dto.orgCode);
  }
}

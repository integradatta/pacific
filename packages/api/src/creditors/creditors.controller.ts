import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CreditorsService } from './creditors.service.js';
import { RegisterCreditorDto } from './dto/register-creditor.dto.js';
import { JwtGuard } from '../auth/jwt.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '@pacific/shared';

@Controller('auth')
export class CreditorsController {
  constructor(private readonly creditors: CreditorsService) {}

  // Exige sessão Supabase válida; identidade derivada do JWT (não do body).
  @Post('register-creditor')
  @UseGuards(new JwtGuard())
  register(
    @CurrentUser() user: AuthUser,
    @Body() dto: RegisterCreditorDto,
  ): Promise<{ tenantId: string; orgCode: string }> {
    return this.creditors.register({ orgName: dto.orgName, supabaseId: user.supabaseId, email: user.email });
  }
}

import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CreditorsService } from './creditors.service.js';
import { RegisterCreditorDto } from './dto/register-creditor.dto.js';
import { JwtGuard } from '../auth/jwt.guard.js';
import { PrincipalGuard } from '../auth/principal.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '@pacific/shared';

export interface MeResponse {
  supabaseId: string;
  email: string;
  role: AuthUser['role'];
  tenantId: string | null; // null = autenticado mas ainda sem carteira (precisa concluir o cadastro)
  approved: boolean; // credor com tenant aprovado E ativo (super-admin/devedor: sempre true)
}

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

  // Quem sou eu? O PrincipalGuard resolve papel/tenant pelo NOSSO banco (por supabaseId).
  // O web usa isto após o login: com tenantId -> dashboard; sem tenantId -> concluir carteira.
  @Get('me')
  @UseGuards(new JwtGuard(), PrincipalGuard)
  me(@CurrentUser() user: AuthUser): MeResponse {
    return { supabaseId: user.supabaseId, email: user.email, role: user.role, tenantId: user.tenantId, approved: user.tenantApproved ?? true };
  }
}

import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CreditorsService } from './creditors.service.js';
import { RegisterCreditorDto } from './dto/register-creditor.dto.js';
import { JwtGuard } from '../auth/jwt.guard.js';
import { IpRateLimitGuard } from '../auth/ip-rate-limit.guard.js';
import { PrincipalGuard } from '../auth/principal.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '@pacific/shared';

// Versão atual do aceite. Bump registra a versão nova nas próximas aceitações (não re-exige de
// quem já aceitou — o gate considera "aceito" quem tem data). v2: texto de responsabilidade revisado.
export const CURRENT_TERMS_VERSION = 'v2';

export interface MeResponse {
  supabaseId: string;
  email: string;
  role: AuthUser['role'];
  tenantId: string | null; // null = autenticado mas ainda sem carteira (precisa concluir o cadastro)
  approved: boolean; // credor com tenant aprovado E ativo (super-admin/devedor: sempre true)
  termsAccepted: boolean; // padrinho já aceitou termos+aviso legal? (não-credor: sempre true)
}

@Controller('auth')
export class CreditorsController {
  constructor(private readonly creditors: CreditorsService) {}

  // Exige sessão Supabase válida; identidade derivada do JWT (não do body).
  @Post('register-creditor')
  @UseGuards(new IpRateLimitGuard(), new JwtGuard())
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
  async me(@CurrentUser() user: AuthUser): Promise<MeResponse> {
    // Aceite de termos só importa para o padrinho (credor). Demais papéis: sempre true (não veem a tela).
    const termsAccepted = user.role === 'CREDITOR' ? await this.creditors.hasAcceptedTerms(user.supabaseId) : true;
    return {
      supabaseId: user.supabaseId,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      approved: user.tenantApproved ?? true,
      termsAccepted,
    };
  }

  // Aceite único (termos de responsabilidade + aviso legal de isenção). Só o padrinho (credor).
  @Post('accept-terms')
  @UseGuards(new JwtGuard(), PrincipalGuard, RolesGuard)
  @Roles('CREDITOR')
  async acceptTerms(@CurrentUser() user: AuthUser): Promise<{ success: true }> {
    await this.creditors.acceptTerms(user.supabaseId, CURRENT_TERMS_VERSION);
    return { success: true };
  }
}

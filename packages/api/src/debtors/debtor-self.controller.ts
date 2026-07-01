import { Body, Controller, Get, Param, Post, UseGuards, ForbiddenException } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength, Matches } from 'class-validator';
import { JwtGuard } from '../auth/jwt.guard.js';
import { TenantGuard } from '../tenancy/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { TenantId } from '../tenancy/tenant-id.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { DebtorSelfService, type MyDebt } from './debtor-self.service.js';
import type { AuthUser } from '@pacific/shared';

export class PushTokenDto {
  @IsString() @MaxLength(512) token!: string;
  @IsIn(['ios', 'android', 'web']) platform!: 'ios' | 'android' | 'web';
}

export class ClaimPaymentDto {
  // Valor monetário em string (ex.: "150.00") — mesma convenção dos demais valores da API.
  @IsString() @Matches(/^\d+(\.\d{1,2})?$/, { message: 'Valor inválido' }) amount!: string;
  @IsOptional() @IsString() @MaxLength(280) note?: string;
}

@Controller('debtor')
@UseGuards(new JwtGuard(), TenantGuard, RolesGuard)
export class DebtorSelfController {
  constructor(private readonly self: DebtorSelfService) {}

  @Get('me/debts') @Roles('DEBTOR')
  myDebts(@TenantId() tenantId: string, @CurrentUser() user: AuthUser): Promise<MyDebt[]> {
    if (!user.debtorId) throw new ForbiddenException('Sessão de devedor inválida');
    return this.self.myDebts(tenantId, user.debtorId);
  }

  // Sobrinho informa um pagamento (aguarda confirmação do padrinho). Não move dinheiro.
  @Post('me/debts/:debtId/claim') @Roles('DEBTOR')
  claimPayment(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('debtId') debtId: string,
    @Body() dto: ClaimPaymentDto,
  ): Promise<void> {
    if (!user.debtorId) throw new ForbiddenException('Sessão de devedor inválida');
    return this.self.claimPayment(tenantId, user.debtorId, debtId, dto.amount, dto.note);
  }

  // App nativo registra o token de push aqui (envio FCM é externo/manual).
  @Post('me/push-token') @Roles('DEBTOR')
  registerPush(@TenantId() tenantId: string, @CurrentUser() user: AuthUser, @Body() dto: PushTokenDto): Promise<void> {
    if (!user.debtorId) throw new ForbiddenException('Sessão de devedor inválida');
    return this.self.registerPushToken(tenantId, user.debtorId, dto.token, dto.platform);
  }
}

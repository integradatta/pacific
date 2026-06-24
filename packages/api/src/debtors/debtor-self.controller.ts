import { Body, Controller, Get, Post, UseGuards, ForbiddenException } from '@nestjs/common';
import { IsIn, IsString, MaxLength } from 'class-validator';
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

@Controller('debtor')
@UseGuards(new JwtGuard(), TenantGuard, RolesGuard)
export class DebtorSelfController {
  constructor(private readonly self: DebtorSelfService) {}

  @Get('me/debts') @Roles('DEBTOR')
  myDebts(@TenantId() tenantId: string, @CurrentUser() user: AuthUser): Promise<MyDebt[]> {
    if (!user.debtorId) throw new ForbiddenException('Sessão de devedor inválida');
    return this.self.myDebts(tenantId, user.debtorId);
  }

  // App nativo registra o token de push aqui (envio FCM é externo/manual).
  @Post('me/push-token') @Roles('DEBTOR')
  registerPush(@TenantId() tenantId: string, @CurrentUser() user: AuthUser, @Body() dto: PushTokenDto): Promise<void> {
    if (!user.debtorId) throw new ForbiddenException('Sessão de devedor inválida');
    return this.self.registerPushToken(tenantId, user.debtorId, dto.token, dto.platform);
  }
}

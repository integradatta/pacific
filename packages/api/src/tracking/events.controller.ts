import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { JwtGuard } from '../auth/jwt.guard.js';
import { PrincipalGuard } from '../auth/principal.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '@pacific/shared';
import { TrackingService } from './tracking.service.js';

export class SessionEventDto {
  @IsIn(['login', 'logout']) type!: 'login' | 'logout';
}

// Registro de sessão do credor/super-admin (o login em si é no Supabase, client-side; o web
// notifica aqui após signIn/signOut para o tracking de acessos).
@Controller('events')
@UseGuards(new JwtGuard(), PrincipalGuard)
export class EventsController {
  constructor(private readonly tracking: TrackingService) {}

  @Post('session')
  session(@CurrentUser() user: AuthUser, @Body() dto: SessionEventDto): Promise<void> {
    return this.tracking.recordRaw({
      tenantId: user.tenantId,
      actorType: user.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'CREDITOR',
      actorId: user.supabaseId,
      type: dto.type === 'login' ? 'LOGIN' : 'LOGOUT',
    });
  }
}

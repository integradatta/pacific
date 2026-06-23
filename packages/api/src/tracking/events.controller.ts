import { Body, Controller, HttpCode, Ip, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsIn } from 'class-validator';
import { JwtGuard } from '../auth/jwt.guard.js';
import { PrincipalGuard } from '../auth/principal.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '@pacific/shared';
import { TrackingService } from './tracking.service.js';

export class SessionEventDto {
  @IsIn(['login', 'logout']) type!: 'login' | 'logout';
}

export class LoginFailedDto {
  @IsEmail() email!: string;
}

// Throttle simples em memória p/ o endpoint público (anti-spam): N por IP por janela.
const hits = new Map<string, { n: number; t: number }>();
function throttled(ip: string, limit = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t >= windowMs) {
    hits.set(ip, { n: 1, t: now });
    return false;
  }
  h.n += 1;
  return h.n > limit;
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

// Endpoint PÚBLICO (sem auth): o login do credor é client-side no Supabase, então uma falha não
// tem token. O web reporta aqui para o super-admin ver tentativas. Throttle por IP contra spam.
@Controller('public/events')
export class PublicEventsController {
  constructor(private readonly tracking: TrackingService) {}

  @Post('login-failed')
  @HttpCode(204)
  async loginFailed(@Body() dto: LoginFailedDto, @Ip() ip: string): Promise<void> {
    if (throttled(ip || 'unknown')) return; // descarta silenciosamente o excesso
    await this.tracking.recordRaw({
      actorType: 'CREDITOR',
      actorId: dto.email.toLowerCase(),
      type: 'LOGIN_FAILED',
      ip: ip || undefined,
    });
  }
}

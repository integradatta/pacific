import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimiter } from './rate-limit.js';
import type { RequestWithPrincipal } from './principal.js';

export interface RateLimitOpts {
  limit: number;
  windowMs: number;
  /** escopo da chave: por usuário (padrão) ou por tenant */
  scope?: 'user' | 'tenant';
}
export const RATE_LIMIT_KEY = 'geo_rate_limit';
export const RateLimit = (opts: RateLimitOpts) => SetMetadata(RATE_LIMIT_KEY, opts);

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly limiter = new RateLimiter();
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const opts = this.reflector.getAllAndOverride<RateLimitOpts | undefined>(RATE_LIMIT_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!opts) return true;
    const req = ctx.switchToHttp().getRequest<RequestWithPrincipal>();
    const p = req.principal;
    const subject = opts.scope === 'tenant' ? p?.tenantId : p?.userId;
    const key = `${ctx.getClass().name}.${ctx.getHandler().name}:${subject ?? 'anon'}`;
    if (!this.limiter.hit(key, opts.limit, opts.windowMs)) {
      throw new HttpException('Limite de requisições excedido. Tente novamente em instantes.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}

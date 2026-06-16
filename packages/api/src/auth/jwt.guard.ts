import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import type { AuthUser } from '@pacific/shared';
import type { RequestWithUser } from './auth.types.js';

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly secret: string = process.env.SUPABASE_JWT_SECRET ?? '') {}
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const header = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Token ausente');
    let payload: jwt.JwtPayload;
    try { payload = jwt.verify(header.slice(7), this.secret) as jwt.JwtPayload; }
    catch { throw new UnauthorizedException('Token inválido'); }
    const meta = (payload.app_metadata ?? {}) as { role?: string; tenantId?: string };
    const role: AuthUser['role'] =
      meta.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : meta.role === 'DEBTOR' ? 'DEBTOR' : 'CREDITOR';
    req.user = {
      supabaseId: String(payload.sub ?? ''),
      email: String(payload.email ?? ''),
      role,
      tenantId: role === 'SUPER_ADMIN' ? null : (meta.tenantId ?? null),
    };
    return true;
  }
}

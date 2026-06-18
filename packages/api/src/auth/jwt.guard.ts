import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import type { AuthUser } from '@pacific/shared';
import type { RequestWithUser } from './auth.types.js';

@Injectable()
export class JwtGuard implements CanActivate {
  // Segredo opcional: quando ausente, é lido de forma lazy no request (após o .env carregar).
  constructor(private readonly secret?: string) {}
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const header = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Token ausente');
    const token = header.slice(7);
    const secrets = this.secret
      ? [this.secret]
      : [process.env.SUPABASE_JWT_SECRET ?? '', process.env.APP_JWT_SECRET ?? ''];
    let payload: jwt.JwtPayload | undefined;
    for (const s of secrets) {
      if (!s) continue;
      try { payload = jwt.verify(token, s) as jwt.JwtPayload; break; } catch { /* tenta o próximo */ }
    }
    if (!payload) throw new UnauthorizedException('Token inválido');
    const meta = (payload.app_metadata ?? {}) as { role?: string; tenantId?: string; debtorId?: string };
    const role: AuthUser['role'] =
      meta.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : meta.role === 'DEBTOR' ? 'DEBTOR' : 'CREDITOR';
    req.user = {
      supabaseId: String(payload.sub ?? ''),
      email: String(payload.email ?? ''),
      role,
      tenantId: role === 'SUPER_ADMIN' ? null : (meta.tenantId ?? null),
      ...(role === 'DEBTOR' ? { debtorId: meta.debtorId ?? String(payload.sub ?? '') } : {}),
    };
    return true;
  }
}

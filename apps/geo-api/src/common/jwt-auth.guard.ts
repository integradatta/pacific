import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { jwtVerify } from 'jose';
import type { Principal, RequestWithPrincipal } from './principal.js';

/**
 * Valida o JWT da plataforma principal e injeta o Principal (sub/tenant_id/roles).
 * NÃO emite token próprio. Aqui uso HS256 com segredo compartilhado (GEO_JWT_SECRET) por
 * simplicidade; para o Supabase (ES256/JWKS) trocar por createRemoteJWKSet — ver core JwtGuard.
 * Pré-requisito de integração: o emissor deve incluir o claim `tenant_id` (Supabase Auth Hook).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly secret = new TextEncoder().encode(process.env.GEO_JWT_SECRET ?? '');

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<RequestWithPrincipal>();
    const auth = req.headers['authorization'];
    const header = Array.isArray(auth) ? auth[0] : auth;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Token ausente');
    try {
      const { payload } = await jwtVerify(header.slice(7), this.secret);
      const tenantId = typeof payload['tenant_id'] === 'string' ? payload['tenant_id'] : undefined;
      const userId = typeof payload.sub === 'string' ? payload.sub : undefined;
      if (!tenantId || !userId) throw new UnauthorizedException('JWT sem tenant_id/sub');
      const rolesClaim = payload['roles'];
      const principal: Principal = {
        userId,
        tenantId,
        roles: Array.isArray(rolesClaim) ? rolesClaim.filter((r): r is string => typeof r === 'string') : [],
      };
      req.principal = principal;
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado');
    }
  }
}

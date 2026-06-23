import { CanActivate, ExecutionContext, Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { createRemoteJWKSet, jwtVerify, decodeJwt } from 'jose';
import type { AuthUser } from '@pacific/shared';
import type { RequestWithUser } from './auth.types.js';

// Claims que nos interessam — comum aos dois emissores (Supabase ES256 e devedor HS256).
type Claims = {
  sub?: string;
  email?: unknown;
  iss?: string;
  iat?: number;
  app_metadata?: { role?: string; tenantId?: string; debtorId?: string };
};

// Cache do conjunto de chaves por URL de JWKS (jose já faz cache interno das chaves).
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
function jwksFor(jwksUrl: URL): ReturnType<typeof createRemoteJWKSet> {
  const key = jwksUrl.toString();
  let set = jwksCache.get(key);
  if (!set) {
    set = createRemoteJWKSet(jwksUrl);
    jwksCache.set(key, set);
  }
  return set;
}

@Injectable()
export class JwtGuard implements CanActivate {
  // Segredo opcional (HS256): usado em testes/uso manual. @Optional p/ o Nest não injetar string.
  constructor(@Optional() private readonly secret?: string) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const header = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Token ausente');
    const token = header.slice(7);

    const payload = await this.verify(token);
    const meta = payload.app_metadata ?? {};
    const role: AuthUser['role'] =
      meta.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : meta.role === 'DEBTOR' ? 'DEBTOR' : 'CREDITOR';
    req.user = {
      supabaseId: String(payload.sub ?? ''),
      email: String(payload.email ?? ''),
      role,
      tenantId: role === 'SUPER_ADMIN' ? null : (meta.tenantId ?? null),
      ...(typeof payload.iat === 'number' ? { tokenIssuedAt: payload.iat } : {}),
      ...(role === 'DEBTOR' ? { debtorId: meta.debtorId ?? String(payload.sub ?? '') } : {}),
    };
    return true;
  }

  private async verify(token: string): Promise<Claims> {
    // 1) Token do Supabase (assimétrico, ES256/RS256) -> verifica pela chave pública (JWKS).
    //    Quando há segredo injetado (HS256), pula esta etapa.
    if (!this.secret) {
      const supabase = await this.trySupabase(token);
      if (supabase) return supabase;
    }
    // 2) Token do devedor (HS256, APP_JWT_SECRET) ou o segredo injetado nos testes.
    const hs = this.secret ?? process.env.APP_JWT_SECRET ?? '';
    if (hs) {
      try {
        return jwt.verify(token, hs) as Claims;
      } catch {
        /* cai no erro abaixo */
      }
    }
    throw new UnauthorizedException('Token inválido');
  }

  // Verifica um access token do Supabase usando a JWKS do próprio projeto (emissor no claim `iss`).
  private async trySupabase(token: string): Promise<Claims | undefined> {
    let iss: string | undefined;
    try {
      iss = decodeJwt(token).iss;
    } catch {
      return undefined;
    }
    if (!iss) return undefined;

    let issUrl: URL;
    try {
      issUrl = new URL(iss);
    } catch {
      return undefined;
    }
    // Aceita apenas emissor Supabase via HTTPS (não busca JWKS de origem arbitrária).
    if (issUrl.protocol !== 'https:' || !issUrl.hostname.endsWith('.supabase.co')) return undefined;
    // Se SUPABASE_URL estiver definido, fixa o emissor esperado (pinning extra).
    const expected = process.env.SUPABASE_URL?.replace(/\/$/, '');
    if (expected && iss !== `${expected}/auth/v1`) return undefined;

    try {
      const jwks = jwksFor(new URL(`${iss}/.well-known/jwks.json`));
      const { payload } = await jwtVerify(token, jwks, { issuer: iss, audience: 'authenticated' });
      return payload as unknown as Claims;
    } catch {
      return undefined;
    }
  }
}

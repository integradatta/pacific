import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { AuthUser } from '@pacific/shared';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';
import type { RequestWithUser } from './auth.types.js';

/**
 * Para usuários autenticados via Supabase (credor/super-admin), o papel e o tenant
 * são a fonte da verdade no NOSSO banco (tabela User por supabaseId), não no JWT.
 * Roda após o JwtGuard e antes do TenantGuard/RolesGuard. Devedores (token próprio)
 * já trazem role/tenant/debtorId nas claims, então são ignorados aqui.
 */
@Injectable()
export class PrincipalGuard implements CanActivate {
  constructor(private readonly scoped: TenantScopedService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = context.switchToHttp().getRequest<RequestWithUser>().user;
    if (user && user.role !== 'DEBTOR' && !user.tenantId) {
      const row = await this.scoped.raw().user.findUnique({ where: { supabaseId: user.supabaseId } });
      if (row) {
        user.role = row.role as AuthUser['role'];
        user.tenantId = row.tenantId;
      }
    }
    return true;
  }
}

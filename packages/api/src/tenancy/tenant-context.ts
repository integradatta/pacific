import type { AuthUser } from '@pacific/shared';

/** Resolve o tenant efetivo do request. Super-admin escolhe via header X-Tenant-Id. */
export function resolveTenantId(user: AuthUser | undefined, headerTenantId: string | undefined): string {
  if (!user) throw new Error('Não autenticado');
  if (user.role === 'SUPER_ADMIN') {
    if (!headerTenantId) throw new Error('Super-admin deve informar X-Tenant-Id');
    return headerTenantId;
  }
  if (!user.tenantId) throw new Error('Usuário sem tenant');
  return user.tenantId;
}

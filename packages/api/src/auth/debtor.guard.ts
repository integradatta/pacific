import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { RequestWithUser } from './auth.types.js';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';

/**
 * Rejeita sessões de devedor ÓRFÃS com um 401 claro ("convite expirado") em vez de falhar em
 * silêncio: se o Debtor não existe mais (ex.: removido, ou o tenant foi apagado), o magic-link
 * JWT antigo passa a não valer — o front então mostra "peça um novo convite" e limpa a sessão.
 *
 * Fail-open: um erro transitório de banco NÃO desloga ninguém (só 401 quando a consulta CONFIRMA
 * que o devedor sumiu). Roda depois do JwtGuard (define user) e do TenantGuard (define tenantId).
 * Aplicado só no caminho de abertura do app (não no hot path do /ping) para não pesar.
 */
@Injectable()
export class DebtorGuard implements CanActivate {
  constructor(private readonly scoped: TenantScopedService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const user = req.user;
    const debtorId = user?.debtorId;
    if (!user || user.role !== 'DEBTOR' || !debtorId || !req.tenantId) return true;
    try {
      const exists = await this.scoped.withTenant(req.tenantId, (tx) =>
        tx.debtor.findUnique({ where: { id: debtorId }, select: { id: true } }),
      );
      if (!exists) throw new UnauthorizedException('Convite expirado. Peça um novo ao seu padrinho.');
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      return true; // erro de banco/transitório → não desloga
    }
    return true;
  }
}

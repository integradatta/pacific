import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { RequestWithUser } from '../auth/auth.types.js';
import { resolveTenantId } from './tenant-context.js';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    try { req.tenantId = resolveTenantId(req.user, req.headers['x-tenant-id']); }
    catch (e) { throw new ForbiddenException((e as Error).message); }
    // Gate de aprovação: credor com tenant pendente/suspenso não acessa endpoints de dados.
    if (req.user?.role === 'CREDITOR' && req.user.tenantApproved === false) {
      throw new ForbiddenException('Conta aguardando aprovação do administrador.');
    }
    return true;
  }
}

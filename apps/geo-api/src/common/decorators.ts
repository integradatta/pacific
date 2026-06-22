import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Principal, RequestWithPrincipal } from './principal.js';

export const CurrentUser = createParamDecorator((_d: unknown, ctx: ExecutionContext): Principal => {
  const req = ctx.switchToHttp().getRequest<RequestWithPrincipal>();
  if (!req.principal) throw new Error('Principal ausente — JwtAuthGuard não rodou?');
  return req.principal;
});

export const CurrentTenant = createParamDecorator((_d: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<RequestWithPrincipal>();
  if (!req.principal) throw new Error('Principal ausente');
  return req.principal.tenantId;
});

export const ROLES_KEY = 'geo_roles';
/** Papéis exigidos no nível do GRUPO (admin/participant/...), checados pelo serviço — ver nota.
 *  Aqui marcamos papéis de PLATAFORMA, se algum dia forem usados; o controle fino é por grupo. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { RequestWithUser } from '../auth/auth.types.js';

export const TenantId = createParamDecorator((_d: unknown, ctx: ExecutionContext): string => {
  const tenantId = ctx.switchToHttp().getRequest<RequestWithUser>().tenantId;
  if (!tenantId) throw new ForbiddenException('TenantId ausente');
  return tenantId;
});

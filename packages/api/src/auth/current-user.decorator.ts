import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestWithUser } from './auth.types.js';
export const CurrentUser = createParamDecorator((_d: unknown, ctx: ExecutionContext) =>
  ctx.switchToHttp().getRequest<RequestWithUser>().user);

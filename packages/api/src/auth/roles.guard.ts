import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@pacific/shared';
import { ROLES_KEY } from './roles.decorator.js';
import type { RequestWithUser } from './auth.types.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.get<UserRole[]>(ROLES_KEY, context.getHandler()) ?? [];
    if (required.length === 0) return true;
    const user = context.switchToHttp().getRequest<RequestWithUser>().user;
    if (!user || !required.includes(user.role)) throw new ForbiddenException('Papel não autorizado');
    return true;
  }
}

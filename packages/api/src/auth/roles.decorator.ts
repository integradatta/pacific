import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@pacific/shared';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]): MethodDecorator => SetMetadata(ROLES_KEY, roles);

import type { AuthUser } from '@pacific/shared';
export type { AuthUser };
export interface RequestWithUser {
  headers: Record<string, string | undefined>;
  user?: AuthUser;
  tenantId?: string;
}

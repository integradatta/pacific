import type { UserRole } from './auth.types.js';

export type TenantApproval = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AdminTenantRow {
  id: string;
  name: string;
  orgCode: string;
  status: 'ACTIVE' | 'SUSPENDED';
  approval: TenantApproval;
  createdAt: string;
  userCount: number;
}

export interface AdminUserRow {
  id: string;
  email: string;
  role: UserRole;
  tenantId: string | null;
  createdAt: string;
}

export interface AdminAuditEntry {
  id: string;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string;
  detail: unknown;
  createdAt: string;
}

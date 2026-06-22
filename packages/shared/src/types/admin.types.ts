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

/** KPIs globais da plataforma (cross-tenant) para a visão geral / executivo. */
export interface AdminOverview {
  creditorsTotal: number;
  creditorsActive: number; // aprovados e ativos
  creditorsBlocked: number; // suspensos
  creditorsPending: number;
  newCreditorsToday: number;
  operationsTotal: number;
  operationsActive: number;
  operationsOverdue: number;
  volumeLent: string; // total emprestado (Decimal string)
  outstanding: string; // total a receber (devido)
  received: string; // total recebido
  loginsToday: number; // acessos de devedores hoje (proxy de atividade)
}

/** Linha de credor com agregados da carteira. */
export interface AdminCreditorRow {
  tenantId: string;
  name: string;
  orgCode: string;
  email: string | null;
  createdAt: string;
  status: 'ACTIVE' | 'SUSPENDED';
  approval: TenantApproval;
  operationsCount: number;
  walletValue: string; // a receber (Decimal string)
}

export type PlatformEventType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'LINK_USED'
  | 'LINK_CREATED'
  | 'LINK_ROTATED'
  | 'ACCESS_REVOKED'
  | 'ACCESS_REACTIVATED'
  | 'OPERATION_CREATED'
  | 'OPERATION_UPDATED'
  | 'OPERATION_PAID'
  | 'CLIENT_CREATED'
  | 'TENANT_APPROVED'
  | 'TENANT_SUSPENDED'
  | 'IMPORTANT';

export type ActorType = 'CREDITOR' | 'DEBTOR' | 'SUPER_ADMIN' | 'SYSTEM';

/** Evento da plataforma (feed de atividade/monitoramento do super-admin). */
export interface AdminEventRow {
  id: string;
  tenantId: string | null;
  actorType: ActorType;
  actorId: string | null;
  type: PlatformEventType;
  targetType: string | null;
  targetId: string | null;
  detail: unknown;
  at: string;
}

/** Link de acesso de devedor (magic link). status derivado de active/rotatedAt. */
export interface AdminAccessLinkRow {
  id: string;
  debtorId: string;
  tenantId: string;
  active: boolean;
  lastSeenAt: string | null;
  rotatedAt: string | null;
  createdAt: string;
}

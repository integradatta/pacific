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

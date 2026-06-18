export type UserRole = 'SUPER_ADMIN' | 'CREDITOR' | 'DEBTOR';
export interface AuthUser {
  supabaseId: string;
  email: string;
  role: UserRole;
  tenantId: string | null; // null apenas para SUPER_ADMIN
  debtorId?: string; // presente quando o sujeito é um devedor (login por link)
}

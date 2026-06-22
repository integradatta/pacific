'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminTenantRow, AdminUserRow, AdminAuditEntry, TenantApproval } from '@pacific/shared';
import { apiGet, apiPost } from './api';

export function useAdminTenants(approval?: TenantApproval) {
  return useQuery({
    queryKey: ['admin', 'tenants', approval ?? 'all'],
    queryFn: () => apiGet<AdminTenantRow[]>(`/admin/tenants${approval ? `?approval=${approval}` : ''}`),
  });
}

export function useAdminUsers() {
  return useQuery({ queryKey: ['admin', 'users'], queryFn: () => apiGet<AdminUserRow[]>('/admin/users') });
}

export function useAdminAudit() {
  return useQuery({ queryKey: ['admin', 'audit'], queryFn: () => apiGet<AdminAuditEntry[]>('/admin/audit') });
}

export type TenantAction = 'approve' | 'reject' | 'suspend' | 'reactivate';

export function useTenantAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: TenantAction }) => apiPost<void>(`/admin/tenants/${id}/${action}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'tenants'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'audit'] });
    },
  });
}

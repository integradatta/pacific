'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminTenantRow, AdminUserRow, AdminAuditEntry, AdminOverview, AdminCreditorRow, AdminAccessLinkRow, AdminEventRow, PlatformEventType, TenantApproval } from '@pacific/shared';
import { apiGet, apiPost } from './api';

export function useAdminEvents(type?: PlatformEventType) {
  return useQuery({
    queryKey: ['admin', 'events', type ?? 'all'],
    queryFn: () => apiGet<AdminEventRow[]>(`/admin/events${type ? `?type=${type}` : ''}`),
  });
}

export function useAdminOverview() {
  return useQuery({ queryKey: ['admin', 'overview'], queryFn: () => apiGet<AdminOverview>('/admin/overview') });
}

export function useAdminCreditors() {
  return useQuery({ queryKey: ['admin', 'creditors'], queryFn: () => apiGet<AdminCreditorRow[]>('/admin/creditors') });
}

export function useAdminLinks() {
  return useQuery({ queryKey: ['admin', 'links'], queryFn: () => apiGet<AdminAccessLinkRow[]>('/admin/access-links') });
}

export function useRevokeLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<void>(`/admin/access-links/${id}/revoke`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'links'] }),
  });
}

export function useAdminAuditFiltered(action?: string) {
  return useQuery({
    queryKey: ['admin', 'audit', action ?? 'all'],
    queryFn: () => apiGet<AdminAuditEntry[]>(`/admin/audit${action ? `?action=${encodeURIComponent(action)}` : ''}`),
  });
}

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

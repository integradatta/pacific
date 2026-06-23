'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminTenantRow, AdminUserRow, AdminAuditEntry, AdminOverview, AdminCreditorRow, AdminAccessLinkRow, AdminEventRow, PlatformEventType, PortfolioRow, TenantApproval } from '@pacific/shared';
import { apiGet, apiPost, apiDelete } from './api';

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

export function useRequestPasswordReset() {
  return useMutation({ mutationFn: (id: string) => apiPost<void>(`/admin/users/${id}/password-reset`) });
}

export function useForceLogoutUser() {
  return useMutation({ mutationFn: (id: string) => apiPost<void>(`/admin/users/${id}/force-logout`) });
}

export function useAdminAudit() {
  return useQuery({ queryKey: ['admin', 'audit'], queryFn: () => apiGet<AdminAuditEntry[]>('/admin/audit') });
}

export type TenantAction = 'approve' | 'reject' | 'suspend' | 'reactivate' | 'block' | 'unblock';

function invalidateAdmin(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['admin', 'tenants'] });
  void qc.invalidateQueries({ queryKey: ['admin', 'creditors'] });
  void qc.invalidateQueries({ queryKey: ['admin', 'audit'] });
}

export function useTenantAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: TenantAction }) => apiPost<void>(`/admin/tenants/${id}/${action}`),
    onSuccess: () => invalidateAdmin(qc),
  });
}

export function useDeleteTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, confirmOrgCode }: { id: string; confirmOrgCode: string }) => apiDelete<void>(`/admin/tenants/${id}`, { confirmOrgCode }),
    onSuccess: () => invalidateAdmin(qc),
  });
}

export function useTenantOperations(id: string) {
  return useQuery({ queryKey: ['admin', 'operations', id], queryFn: () => apiGet<PortfolioRow[]>(`/admin/tenants/${id}/operations`) });
}

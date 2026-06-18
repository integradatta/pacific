'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from './api';

export interface DebtorRow {
  id: string;
  name: string;
  active: boolean;
  lastSeenAt: string | null;
}
interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export function useDebtors() {
  return useQuery({ queryKey: ['debtors'], queryFn: () => apiGet<Page<DebtorRow>>('/debtors?limit=100') });
}

export function useDebtorMutations() {
  const qc = useQueryClient();
  const invalidate = (): void => {
    void qc.invalidateQueries({ queryKey: ['debtors'] });
  };
  return {
    create: useMutation({
      mutationFn: (name: string) => apiPost<{ debtorId: string; accessLink: string }>('/debtors', { name }),
      onSuccess: invalidate,
    }),
    rotate: useMutation({
      mutationFn: (id: string) => apiPost<{ accessLink: string }>(`/debtors/${id}/rotate-link`),
      onSuccess: invalidate,
    }),
    revoke: useMutation({
      mutationFn: (id: string) => apiPost<void>(`/debtors/${id}/revoke`),
      onSuccess: invalidate,
    }),
    reactivate: useMutation({
      mutationFn: (id: string) => apiPost<void>(`/debtors/${id}/reactivate`),
      onSuccess: invalidate,
    }),
  };
}

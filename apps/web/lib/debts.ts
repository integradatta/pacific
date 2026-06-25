'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DebtRecord, DebtSummary, DebtEvent } from '@pacific/shared';
import { apiGet, apiPatch, apiPost, apiDelete } from './api';

export function useDebt(id: string) {
  return useQuery({ queryKey: ['debt', id], queryFn: () => apiGet<DebtRecord>(`/debts/${id}`) });
}

export function useDebtSummary(id: string) {
  return useQuery({ queryKey: ['debt', id, 'summary'], queryFn: () => apiGet<DebtSummary>(`/debts/${id}/summary`) });
}

export function useDebtHistory(id: string) {
  return useQuery({ queryKey: ['debt', id, 'history'], queryFn: () => apiGet<DebtEvent[]>(`/debts/${id}/history`) });
}

/** Atualiza as etiquetas da operação; invalida o registro e a carteira. */
export function useSetDebtTags(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tags: string[]) => apiPatch<DebtRecord>(`/debts/${id}/tags`, { tags }),
    onSuccess: (rec) => {
      qc.setQueryData(['debt', id], rec);
      void qc.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });
}

/** Registra pagamento (parcial: { amount } ou total: { full: true }) e atualiza tudo. */
export function usePayDebt(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { amount?: string; full?: boolean }) => apiPost<DebtRecord>(`/debts/${id}/payments`, input),
    onSuccess: (rec) => {
      qc.setQueryData(['debt', id], rec);
      void qc.invalidateQueries({ queryKey: ['debt', id, 'summary'] });
      void qc.invalidateQueries({ queryKey: ['debt', id, 'history'] });
      void qc.invalidateQueries({ queryKey: ['portfolio'] });
      void qc.invalidateQueries({ queryKey: ['kpis'] });
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/** Exclui a operação (destrutivo). Invalida a carteira/KPIs. */
export function useDeleteDebt(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiDelete<void>(`/debts/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['portfolio'] });
      void qc.invalidateQueries({ queryKey: ['kpis'] });
    },
  });
}

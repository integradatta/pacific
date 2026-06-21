'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DebtRecord, DebtSummary, DebtEvent } from '@pacific/shared';
import { apiGet, apiPatch } from './api';

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

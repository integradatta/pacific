'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DebtorProfile } from '@pacific/shared';
import { apiGet, apiPost } from './api';

/** Perfil comportamental de um sobrinho (#2 + #6). Derivado de dados já coletados. */
export function useDebtorProfile(debtorId: string | undefined) {
  return useQuery({
    queryKey: ['insights', 'profile', debtorId],
    queryFn: () => apiGet<DebtorProfile>(`/insights/debtors/${debtorId}/profile`),
    enabled: !!debtorId,
    staleTime: 5 * 60_000,
  });
}

export interface DebtorSignal { id: string; kind: 'INTENT_TO_PAY' | 'NEED_SUPPORT'; dueDate: string | null; note: string | null; createdAt: string }

/** Sinais em aberto do sobrinho (intenção de pagar / pedido de suporte). */
export function useDebtorSignals(debtorId: string | undefined) {
  return useQuery({
    queryKey: ['insights', 'signals', debtorId],
    queryFn: () => apiGet<DebtorSignal[]>(`/insights/debtors/${debtorId}/signals`),
    enabled: !!debtorId,
  });
}

export function useResolveSignal(debtorId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<void>(`/insights/signals/${id}/resolve`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['insights', 'signals', debtorId] }),
  });
}

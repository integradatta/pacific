'use client';

import { useQuery } from '@tanstack/react-query';
import type { DebtorProfile } from '@pacific/shared';
import { apiGet } from './api';

/** Perfil comportamental de um sobrinho (#2 + #6). Derivado de dados já coletados. */
export function useDebtorProfile(debtorId: string | undefined) {
  return useQuery({
    queryKey: ['insights', 'profile', debtorId],
    queryFn: () => apiGet<DebtorProfile>(`/insights/debtors/${debtorId}/profile`),
    enabled: !!debtorId,
    staleTime: 5 * 60_000,
  });
}

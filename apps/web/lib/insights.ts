'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DebtorProfile, CashForecast } from '@pacific/shared';
import { apiGet, apiPost } from './api';

export interface CoolingRow { debtId: string; debtorId: string; debtorName: string; amountDue: string; daysRemaining: number; score: number; reasons: string[] }

/** #4 Previsão de caixa ponderada (faixas + por mês). */
export function useCashForecast() {
  return useQuery({ queryKey: ['insights', 'cash-forecast'], queryFn: () => apiGet<CashForecast>('/insights/cash-forecast'), staleTime: 5 * 60_000 });
}

/** #5 Radar de esfriamento (sobrinhos com sinais de risco). */
export function useRadar() {
  return useQuery({ queryKey: ['insights', 'radar'], queryFn: () => apiGet<CoolingRow[]>('/insights/radar'), staleTime: 5 * 60_000 });
}

export interface Simulation {
  portfolioOutstanding: number;
  newShareOfPortfolio: number;
  concentrationHigh: boolean;
  debtorExposureBefore: number | null;
  debtorExposureAfter: number | null;
  debtorShareAfter: number | null;
  expectedDelayDays: number | null;
  reliability: string | null;
}

/** #9 Simulação de impacto na carteira (para o valor informado). null desabilita. */
export function useSimulate(amount: number | null) {
  return useQuery({
    queryKey: ['insights', 'simulate', amount],
    queryFn: () => apiPost<Simulation>('/insights/simulate', { amount }),
    enabled: amount != null && amount > 0,
    staleTime: 60_000,
  });
}

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

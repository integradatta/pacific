'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DebtorProfile, CashForecast, PricingHistory } from '@pacific/shared';
import { apiGet, apiPost, apiDelete } from './api';

/** P6 — histórico de precificação do padrinho (taxa × desfecho). Alimenta o hint sugestivo ao cadastrar. */
export function usePricing() {
  return useQuery({ queryKey: ['insights', 'pricing'], queryFn: () => apiGet<PricingHistory>('/insights/pricing'), staleTime: 10 * 60_000 });
}

/** #4 Previsão de caixa ponderada (faixas + por mês). */
export function useCashForecast() {
  return useQuery({ queryKey: ['insights', 'cash-forecast'], queryFn: () => apiGet<CashForecast>('/insights/cash-forecast'), staleTime: 5 * 60_000 });
}

// (useRadar/CoolingRow removidos: o radar alimenta as sugestões do "Hoje" no servidor — o endpoint
// GET /insights/radar continua existindo; nenhuma tela consome o hook diretamente.)

export interface Suggestion { id: string; kind: 'support' | 'claim' | 'cooling' | 'overdue' | 'due_soon' | 'intent' | 'promise'; title: string; body: string; href?: string; priority: number }

/** #1 "Hoje" — sugestões acionáveis (compostas dos sinais). Tom de sugestão, nunca ordem. */
export function useSuggestions() {
  return useQuery({ queryKey: ['insights', 'suggestions'], queryFn: () => apiGet<Suggestion[]>('/insights/suggestions'), staleTime: 2 * 60_000 });
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

// #4 Promessas rastreadas
export interface PromiseRow { id: string; debtId: string; amount: string | null; promisedAt: string; note: string | null; status: 'OPEN' | 'KEPT' | 'BROKEN'; createdAt: string; resolvedAt: string | null }

/** Promessas de um sobrinho (combinou pagar até uma data; desfecho rastreado). */
export function useDebtorPromises(debtorId: string | undefined) {
  return useQuery({
    queryKey: ['insights', 'promises', debtorId],
    queryFn: () => apiGet<PromiseRow[]>(`/insights/debtors/${debtorId}/promises`),
    enabled: !!debtorId,
    staleTime: 60_000,
  });
}

export function useCreatePromise(debtorId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { debtId: string; promisedAt: string; amount?: string; note?: string }) => apiPost<PromiseRow>('/insights/promises', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['insights', 'promises', debtorId] });
      void qc.invalidateQueries({ queryKey: ['insights', 'profile', debtorId] });
    },
  });
}

export function useDeletePromise(debtorId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/insights/promises/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['insights', 'promises', debtorId] });
      void qc.invalidateQueries({ queryKey: ['insights', 'profile', debtorId] });
    },
  });
}

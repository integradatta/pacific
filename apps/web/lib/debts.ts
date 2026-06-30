'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DebtRecord, DebtSummary, DebtEvent } from '@pacific/shared';
import { apiGet, apiPatch, apiPost, apiDelete } from './api';

/** Pagamento informado pelo sobrinho, aguardando confirmação do padrinho. */
export interface PaymentClaimRow {
  id: string;
  debtId: string;
  debtorName: string;
  amount: string;
  note: string | null;
  claimedAt: string;
}

export function useDebt(id: string) {
  return useQuery({ queryKey: ['debt', id], queryFn: () => apiGet<DebtRecord>(`/debts/${id}`) });
}

/** Pagamentos informados pelos sobrinhos aguardando confirmação (toda a carteira). */
export function usePendingClaims() {
  return useQuery({ queryKey: ['claims', 'pending'], queryFn: () => apiGet<PaymentClaimRow[]>('/debts/claims/pending') });
}

/** Confirma um pagamento informado → vira pagamento de fato. Atualiza carteira/KPIs/claims. */
export function useConfirmClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<void>(`/debts/claims/${id}/confirm`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['claims'] });
      void qc.invalidateQueries({ queryKey: ['portfolio'] });
      void qc.invalidateQueries({ queryKey: ['kpis'] });
      void qc.invalidateQueries({ queryKey: ['debt'] });
    },
  });
}

/** Recusa um pagamento informado (não bate). */
export function useRejectClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<void>(`/debts/claims/${id}/reject`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['claims'] }),
  });
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

/** Renegocia a operação (novo vencimento + taxa opcional). Atualiza registro/summary/histórico. */
export function useRenegotiateDebt(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { dueDate: string; rate?: string; ratePeriod?: 'MONTHLY' | 'ANNUAL' }) =>
      apiPost<DebtRecord>(`/debts/${id}/renegotiate`, input),
    onSuccess: (rec) => {
      qc.setQueryData(['debt', id], rec);
      void qc.invalidateQueries({ queryKey: ['debt', id, 'summary'] });
      void qc.invalidateQueries({ queryKey: ['debt', id, 'history'] });
      void qc.invalidateQueries({ queryKey: ['portfolio'] });
      void qc.invalidateQueries({ queryKey: ['kpis'] });
    },
  });
}

/** Move a operação para a lixeira (restaurável por 30 dias). Invalida carteira/KPIs/lixeira. */
export function useDeleteDebt(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiDelete<void>(`/debts/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['portfolio'] });
      void qc.invalidateQueries({ queryKey: ['kpis'] });
      void qc.invalidateQueries({ queryKey: ['trash'] });
    },
  });
}

/** Operação na lixeira (excluída, restaurável). */
export interface TrashRow {
  id: string;
  debtorName: string;
  principal: string;
  deletedAt: string;
}

/** Lista a lixeira (operações excluídas, restauráveis por 30 dias). */
export function useTrash() {
  return useQuery({ queryKey: ['trash'], queryFn: () => apiGet<TrashRow[]>('/debts/trash') });
}

/** Restaura uma operação da lixeira. Invalida lixeira/carteira/KPIs. */
export function useRestoreDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<void>(`/debts/${id}/restore`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['trash'] });
      void qc.invalidateQueries({ queryKey: ['portfolio'] });
      void qc.invalidateQueries({ queryKey: ['kpis'] });
    },
  });
}

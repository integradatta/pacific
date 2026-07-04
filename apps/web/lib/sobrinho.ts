'use client';

import { useQuery } from '@tanstack/react-query';
import type { DebtStatus } from '@pacific/shared';
import { debtorApiGet } from '@/lib/debtor';

// Tipos do que a API do sobrinho já devolve (NÃO alteramos backend). A UI apresenta como um
// "cofre / meta de economia" — os dados por baixo são os mesmos, só o enquadramento muda.
export interface PaymentPoint { at: string; total: string } // cada "depósito" no cofre
export interface PendingClaim { amount: string; claimedAt: string }
export interface RejectedClaim { amount: string; resolvedAt: string }
export interface MyGoal {
  id: string;
  principal: string;
  dueDate: string;
  payments: PaymentPoint[];
  pendingClaim: PendingClaim | null;
  rejectedClaim: RejectedClaim | null;
  summary: {
    balance: string; // valor da META (alvo total)
    accruedInterest: string; // (não exibido no app — evita quebrar a metáfora de economia)
    paidAmount: string; // já GUARDADO
    amountDue: string; // FALTA guardar
    settled: boolean;
    daysRemaining: number;
    status: DebtStatus;
  };
}
/** Alias legado (o backend chama de "debt"; na UI do sobrinho é sempre uma meta/cofre). */
export type MyDebt = MyGoal;

export function useMyDebts() {
  return useQuery({ queryKey: ['me-debts'], queryFn: () => debtorApiGet<MyGoal[]>('/debtor/me/debts') });
}

// A meta "principal" = a primeira em aberto; senão a primeira registrada.
export function pickPrimary(goals: MyGoal[]): MyGoal | undefined {
  return goals.find((g) => !g.summary.settled) ?? goals[0];
}

// Valores do cofre: meta (alvo), guardado (já poupado) e falta guardar.
export function cofreValues(g: MyGoal) {
  const meta = Number(g.summary.balance);
  const guardado = Number(g.summary.paidAmount);
  const faltaGuardar = Number(g.summary.amountDue);
  const pct = g.summary.settled ? 100 : Math.round((guardado / Math.max(meta, 1)) * 100);
  return { meta, guardado, faltaGuardar, pct };
}

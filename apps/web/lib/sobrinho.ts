'use client';

import { useQuery } from '@tanstack/react-query';
import type { DebtStatus } from '@pacific/shared';
import { debtorApiGet } from '@/lib/debtor';

// Tipos do que a API do sobrinho já devolve (NÃO alteramos backend). "Viagem" é a metáfora
// de UI para o combinado com o padrinho — os dados por baixo são os mesmos.
export interface PaymentPoint { at: string; total: string }
export interface PendingClaim { amount: string; claimedAt: string }
export interface MyDebt {
  id: string;
  principal: string;
  dueDate: string;
  payments: PaymentPoint[];
  pendingClaim: PendingClaim | null;
  summary: {
    balance: string; // total combinado (valor + gratidão)
    accruedInterest: string; // gratidão acumulada
    paidAmount: string; // já resolvido
    amountDue: string; // ainda falta
    settled: boolean;
    daysRemaining: number;
    status: DebtStatus;
  };
}

export function useMyDebts() {
  return useQuery({ queryKey: ['me-debts'], queryFn: () => debtorApiGet<MyDebt[]>('/debtor/me/debts') });
}

// A viagem "principal" = a primeira em aberto; senão a primeira registrada.
export function pickPrimary(debts: MyDebt[]): MyDebt | undefined {
  return debts.find((d) => !d.summary.settled) ?? debts[0];
}

// Valores da viagem, em linguagem gentil.
export function tripValues(d: MyDebt) {
  const combinado = Number(d.summary.balance);
  const resolvido = Number(d.summary.paidAmount);
  const falta = Number(d.summary.amountDue);
  const pct = d.summary.settled ? 100 : Math.round((resolvido / Math.max(combinado, 1)) * 100);
  return { combinado, resolvido, falta, pct };
}

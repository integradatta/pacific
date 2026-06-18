'use client';

import { useQuery } from '@tanstack/react-query';
import type { DebtStatus } from '@pacific/shared';
import { debtorApiGet } from '@/lib/debtor';
import { formatBRL, venceEm } from '@/lib/format';
import { STATUS_COLOR, STATUS_LABEL } from '@/lib/status';

interface MyDebt {
  id: string;
  dueDate: string;
  summary: {
    balance: string;
    accruedInterest: string;
    daysRemaining: number;
    status: DebtStatus;
    projections: { horizonDays: number; balance: string }[];
  };
}

const HORIZON_LABEL: Record<number, string> = { 0: 'Hoje', 30: '30 dias', 90: '90 dias', 180: '180 dias', 365: '1 ano' };

function DebtCard({ debt }: { debt: MyDebt }) {
  const s = debt.summary;
  return (
    <section className="bg-surface border border-line rounded-xl p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[10px] text-muted uppercase tracking-widest mb-1">Saldo atual</p>
          <p className="font-mono text-3xl font-medium text-text tabular-nums">{formatBRL(s.balance)}</p>
          <p className="font-mono text-[11px] text-muted mt-1">juros acumulados {formatBRL(s.accruedInterest)}</p>
        </div>
        <span className="inline-flex items-center gap-2 font-mono text-xs text-muted">
          <span className={`w-2 h-2 rounded-full ${STATUS_COLOR[s.status]}`} />
          {STATUS_LABEL[s.status]}
        </span>
      </div>

      <div className="flex items-center gap-6 border-t border-line pt-4 font-mono text-xs">
        <span className="text-muted">vencimento <span className="text-text">{new Date(debt.dueDate).toLocaleDateString('pt-BR')}</span></span>
        <span className="text-muted">{venceEm(s.daysRemaining)}</span>
      </div>

      <div>
        <p className="font-mono text-[10px] text-muted uppercase tracking-widest mb-2">Projeção do saldo</p>
        <div className="grid grid-cols-5 gap-2">
          {s.projections.map((p) => (
            <div key={p.horizonDays} className="text-center">
              <p className="font-mono text-[10px] text-muted">{HORIZON_LABEL[p.horizonDays] ?? `${p.horizonDays}d`}</p>
              <p className="font-mono text-xs text-text tabular-nums mt-1">{formatBRL(p.balance)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function MePage() {
  const q = useQuery({ queryKey: ['me-debts'], queryFn: () => debtorApiGet<MyDebt[]>('/debtor/me/debts') });

  return (
    <main className="min-h-screen bg-ink px-4 py-10">
      <div className="max-w-md mx-auto space-y-6">
        <header className="space-y-1">
          <p className="font-mono text-[10px] text-muted uppercase tracking-widest">Pacific</p>
          <h1 className="font-display text-2xl font-semibold text-text tracking-tight">Sua dívida</h1>
        </header>

        {q.isLoading ? (
          <div className="bg-surface border border-line rounded-xl p-10 text-center">
            <p className="font-mono text-sm text-muted tracking-wider animate-pulse">Carregando…</p>
          </div>
        ) : q.isError ? (
          <div className="bg-surface border border-status-red/40 rounded-xl p-8" role="alert">
            <p className="font-mono text-sm text-status-red">Não foi possível carregar. Abra novamente o link do seu credor.</p>
          </div>
        ) : (q.data ?? []).length === 0 ? (
          <div className="bg-surface border border-line rounded-xl p-10 text-center">
            <p className="font-mono text-sm text-muted">Nenhuma dívida registrada.</p>
          </div>
        ) : (
          (q.data ?? []).map((d) => <DebtCard key={d.id} debt={d} />)
        )}
      </div>
    </main>
  );
}

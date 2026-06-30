'use client';

import { useQuery } from '@tanstack/react-query';
import { Decimal } from 'decimal.js';
import type { DebtStatus } from '@pacific/shared';
import { debtorApiGet } from '@/lib/debtor';
import { formatBRL } from '@/lib/format';
import { Skeleton } from '@/components/Skeleton';
import { ErrorState, EmptyState } from '@/components/States';

interface PaymentPoint { at: string; total: string }
interface MyDebt {
  id: string;
  principal: string;
  dueDate: string;
  payments: PaymentPoint[];
  summary: {
    balance: string;
    accruedInterest: string;
    paidAmount: string;
    amountDue: string;
    settled: boolean;
    daysRemaining: number;
    status: DebtStatus;
  };
}

// Semáforo simples (sem indicadores técnicos de risco): só em dia / atenção / em atraso.
function semaphore(status: DebtStatus, settled: boolean) {
  if (settled) return { dot: 'bg-status-green', text: 'text-status-green', icon: '🟢', label: 'Quitada', action: 'Nenhuma ação necessária' };
  if (status === 'RED') return { dot: 'bg-status-red', text: 'text-status-red', icon: '🔴', label: 'Em atraso', action: 'Requer ação imediata' };
  if (status === 'YELLOW' || status === 'ORANGE') return { dot: 'bg-status-yellow', text: 'text-status-yellow', icon: '🟡', label: 'Atenção', action: 'Vencimento próximo' };
  return { dot: 'bg-status-green', text: 'text-status-green', icon: '🟢', label: 'Em dia', action: 'Nenhuma ação necessária' };
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
const diasLabel = (d: number) => (d < 0 ? `${Math.abs(d)} dias em atraso` : d === 0 ? 'vence hoje' : `${d} dias`);

function smartSummary(d: MyDebt): string {
  const s = d.summary;
  if (s.settled) return 'Sua ajuda está quitada. Não há valor em aberto.';
  const sit = s.status === 'RED' ? 'está em atraso' : s.status === 'YELLOW' || s.status === 'ORANGE' ? 'tem vencimento próximo' : 'está em dia';
  const venc = s.daysRemaining < 0 ? `venceu há ${Math.abs(s.daysRemaining)} dias` : s.daysRemaining === 0 ? 'vence hoje' : `vence em ${s.daysRemaining} dias`;
  return `Sua ajuda ${sit} e ${venc}. O valor atual é de ${formatBRL(s.amountDue)}.`;
}

// Evolução: valor original (+) gratidão acumulada (−) pagamentos (=) valor atual. Barras proporcionais ao saldo bruto.
function Evolution({ debt }: { debt: MyDebt }) {
  const s = debt.summary;
  const base = Math.max(Number(s.balance), 1);
  const rows = [
    { label: 'Valor original', value: debt.principal, cls: 'bg-sonar', op: '' },
    { label: 'Gratidão acumulada', value: s.accruedInterest, cls: 'bg-status-yellow', op: '+' },
    { label: 'Pagamentos', value: s.paidAmount, cls: 'bg-status-green', op: '−' },
  ];
  return (
    <section className="panel p-5">
      <p className="font-mono text-[10px] text-muted uppercase tracking-widest mb-4">Evolução da ajuda</p>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="font-sans text-sm text-text-dim">{r.op && <span className="text-muted mr-1">{r.op}</span>}{r.label}</span>
              <span className="font-mono text-sm text-text tabular-nums">{formatBRL(r.value)}</span>
            </div>
            <span className="block h-1.5 rounded-full bg-line overflow-hidden">
              <span className={`block h-full ${r.cls}`} style={{ width: `${Math.min(100, (Number(r.value) / base) * 100)}%` }} />
            </span>
          </div>
        ))}
        <div className="flex items-baseline justify-between border-t border-line pt-3">
          <span className="font-sans text-sm text-text">= Valor atual</span>
          <span className="font-mono text-lg text-text tabular-nums font-medium">{formatBRL(s.amountDue)}</span>
        </div>
      </div>
    </section>
  );
}

// Próximos eventos: marcos futuros derivados do vencimento (lembretes automáticos + vencimento).
function UpcomingEvents({ debt }: { debt: MyDebt }) {
  if (debt.summary.settled) return null;
  const due = new Date(debt.dueDate);
  const now = new Date();
  const day = 86_400_000;
  const marks = [
    { at: new Date(due.getTime() - 7 * day), label: 'Lembrete automático' },
    { at: new Date(due.getTime() - 3 * day), label: 'Lembrete automático' },
    { at: new Date(due.getTime() - day), label: 'Lembrete: vence amanhã' },
    { at: due, label: 'Vencimento' },
  ].filter((m) => m.at.getTime() >= now.getTime() - day);
  if (marks.length === 0) return null;
  return (
    <section className="panel p-5">
      <p className="font-mono text-[10px] text-muted uppercase tracking-widest mb-3">Próximos eventos</p>
      <ol className="space-y-2.5">
        {marks.map((m, i) => (
          <li key={i} className="flex items-center gap-3">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.label === 'Vencimento' ? 'bg-status-yellow' : 'bg-sonar/60'}`} />
            <span className="font-mono text-xs text-text tabular-nums w-14">{fmtDate(m.at.toISOString())}</span>
            <span className="font-sans text-sm text-text-dim">{m.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// Histórico financeiro: cada pagamento (data, valor pago no momento, total acumulado).
function History({ payments }: { payments: PaymentPoint[] }) {
  if (payments.length === 0) {
    return (
      <section className="panel p-5">
        <p className="font-mono text-[10px] text-muted uppercase tracking-widest mb-2">Histórico financeiro</p>
        <p className="font-sans text-sm text-text-dim">Nenhum pagamento registrado ainda.</p>
      </section>
    );
  }
  let prev = new Decimal(0);
  const rows = payments.map((p) => {
    const total = new Decimal(p.total);
    const inc = Decimal.max(0, total.minus(prev));
    prev = total;
    return { at: p.at, inc: inc.toFixed(2), total: total.toFixed(2) };
  }).reverse();
  return (
    <section className="panel overflow-hidden">
      <p className="font-mono text-[10px] text-muted uppercase tracking-widest px-5 pt-5 pb-2">Histórico financeiro</p>
      <ul className="divide-y divide-line/70">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center justify-between gap-3 px-5 py-3">
            <div>
              <p className="font-sans text-sm text-text">Pagamento</p>
              <p className="font-mono text-[11px] text-muted tabular-nums">{fmtDate(r.at)}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm text-status-green tabular-nums">+ {formatBRL(r.inc)}</p>
              <p className="font-mono text-[10px] text-muted tabular-nums">total pago {formatBRL(r.total)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DebtView({ debt }: { debt: MyDebt }) {
  const s = debt.summary;
  const sem = semaphore(s.status, s.settled);
  return (
    <div className="space-y-4">
      {/* Hero — valor + vencimento + dias (leitura em segundos) */}
      <section className="panel p-6 space-y-5 border-l-2" style={{ borderLeftColor: 'rgb(var(--sonar))' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] text-muted uppercase tracking-widest mb-1">{s.settled ? 'Ajuda quitada' : 'Valor atual · em aberto'}</p>
            <p className={`font-mono text-3xl sm:text-4xl font-medium tabular-nums tracking-tight break-words ${s.settled ? 'text-status-green' : 'text-text'}`}>
              {formatBRL(s.settled ? '0.00' : s.amountDue)}
            </p>
          </div>
          <span className={`inline-flex items-center gap-1.5 font-mono text-xs shrink-0 ${sem.text}`}>
            <span className={`w-2 h-2 rounded-full ${sem.dot}`} /> {sem.label}
          </span>
        </div>
        {!s.settled && (
          <div className="grid grid-cols-2 gap-4 border-t border-line pt-4">
            <div>
              <p className="font-mono text-[10px] text-muted uppercase tracking-widest mb-1">Vencimento</p>
              <p className="font-mono text-lg text-text tabular-nums">{fmtDate(debt.dueDate)}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] text-muted uppercase tracking-widest mb-1">Dias restantes</p>
              <p className={`font-mono text-lg tabular-nums ${s.daysRemaining < 0 ? 'text-status-red' : 'text-text'}`}>{diasLabel(s.daysRemaining)}</p>
            </div>
          </div>
        )}
      </section>

      {/* Resumo inteligente */}
      <section className="panel p-5">
        <p className="font-sans text-[15px] text-text-dim leading-relaxed">{smartSummary(debt)}</p>
      </section>

      {/* Semáforo de situação */}
      <section className={`panel p-5 flex items-center gap-4 ${sem.text}`}>
        <span className="text-2xl" aria-hidden>{sem.icon}</span>
        <div>
          <p className="font-display text-lg font-semibold tracking-tight">{sem.label}</p>
          <p className="font-sans text-sm text-text-dim">{sem.action}</p>
        </div>
      </section>

      <Evolution debt={debt} />
      <UpcomingEvents debt={debt} />
      <History payments={debt.payments} />

      {/* O que acontece agora? */}
      {!s.settled && (
        <section className="panel p-6 space-y-4">
          <p className="font-mono text-[10px] text-muted uppercase tracking-widest">O que acontece agora?</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-mono text-[10px] text-muted uppercase tracking-widest mb-1">Próximo vencimento</p>
              <p className="font-mono text-base text-text tabular-nums">{fmtDate(debt.dueDate)}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] text-muted uppercase tracking-widest mb-1">Valor previsto</p>
              <p className="font-mono text-base text-text tabular-nums">{formatBRL(s.amountDue)}</p>
            </div>
          </div>
          <p className="font-sans text-sm text-text-dim leading-relaxed border-t border-line pt-4">
            Mantenha o pagamento até a data de vencimento para evitar gratidão adicional.
          </p>
        </section>
      )}
    </div>
  );
}

export default function MePage() {
  const q = useQuery({ queryKey: ['me-debts'], queryFn: () => debtorApiGet<MyDebt[]>('/debtor/me/debts') });
  const debts = q.data ?? [];
  // Foco na dívida mais relevante: a primeira em aberto (mais próxima do vencimento), senão a primeira.
  const primary = debts.find((d) => !d.summary.settled) ?? debts[0];
  const others = debts.filter((d) => d !== primary);

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="max-w-md mx-auto space-y-6 animate-rise">
        <header className="space-y-1">
          <p className="font-mono text-[10px] text-muted uppercase tracking-[0.2em]">Pacific</p>
          <h1 className="font-display text-2xl font-semibold text-text tracking-tight">Sua ajuda</h1>
        </header>

        {q.isLoading ? (
          <div className="panel p-6 space-y-5">
            <Skeleton className="h-3 w-28 rounded" />
            <Skeleton className="h-10 w-48 rounded" />
            <Skeleton className="h-px w-full" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-10 rounded" />
              <Skeleton className="h-10 rounded" />
            </div>
          </div>
        ) : q.isError ? (
          <ErrorState message="Não foi possível carregar. Abra novamente o link do seu padrinho." />
        ) : !primary ? (
          <EmptyState glyph="◇" title="Nenhuma ajuda registrada." />
        ) : (
          <>
            <DebtView debt={primary} />
            {others.length > 0 && (
              <section className="panel p-5">
                <p className="font-mono text-[10px] text-muted uppercase tracking-widest mb-3">Outras ajudas</p>
                <ul className="divide-y divide-line/70 -my-2">
                  {others.map((d) => {
                    const sem = semaphore(d.summary.status, d.summary.settled);
                    return (
                      <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                        <span className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${sem.dot}`} />
                          <span className="font-mono text-xs text-muted tabular-nums">vence {fmtDate(d.dueDate)}</span>
                        </span>
                        <span className="font-mono text-sm text-text tabular-nums">{formatBRL(d.summary.settled ? '0.00' : d.summary.amountDue)}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

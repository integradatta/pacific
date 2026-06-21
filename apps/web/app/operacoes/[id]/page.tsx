'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { DebtEvent, DebtEventKind, DebtSummary } from '@pacific/shared';
import { Shell } from '@/components/Shell';
import { Skeleton } from '@/components/Skeleton';
import { ErrorState } from '@/components/States';
import { TagInput } from '@/components/Tags';
import { RiskBadge } from '@/components/RiskBadge';
import { useDebt, useDebtSummary, useDebtHistory, useSetDebtTags, usePayDebt } from '@/lib/debts';
import { formatBRL, venceEm } from '@/lib/format';
import { STATUS_COLOR, STATUS_LABEL } from '@/lib/status';

const HORIZON_LABEL: Record<number, string> = { 0: 'Hoje', 30: '30 dias', 90: '90 dias', 180: '180 dias', 365: '1 ano' };
const RATE_PERIOD_LABEL = { MONTHLY: 'ao mês', ANNUAL: 'ao ano' } as const;

const EVENT_GLYPH: Record<DebtEventKind, string> = {
  created: '✦',
  link: '◈',
  login: '◉',
  notification: '◎',
  due: '◷',
  paid: '✓',
};

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR');
}

function Timeline({ events }: { events: DebtEvent[] }) {
  if (events.length === 0) {
    return <p className="font-sans text-sm text-text-dim">Sem eventos registrados ainda.</p>;
  }
  return (
    <ol className="relative">
      {/* trilho */}
      <span className="absolute left-[11px] top-1 bottom-1 w-px bg-line" aria-hidden />
      {events.map((e, i) => (
        <li key={`${e.at}-${i}`} className="relative flex gap-4 pb-5 last:pb-0">
          <span
            className={`relative z-10 shrink-0 w-6 h-6 rounded-full border border-line bg-surface2 flex items-center justify-center text-[11px] ${
              e.kind === 'due' ? 'text-status-red' : e.kind === 'paid' ? 'text-status-green' : 'text-sonar'
            }`}
            aria-hidden
          >
            {EVENT_GLYPH[e.kind]}
          </span>
          <div className="min-w-0 -mt-0.5">
            <p className="font-sans text-sm text-text">{e.title}</p>
            {e.detail ? <p className="font-sans text-sm text-text-dim mt-0.5">{e.detail}</p> : null}
            <p className="font-mono text-[10px] text-muted uppercase tracking-wider mt-1 tabular-nums">{fmtDateTime(e.at)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/60 pb-2 last:border-0">
      <dt className="font-mono text-[11px] text-muted uppercase tracking-wider">{label}</dt>
      <dd className="font-mono text-sm text-text tabular-nums text-right">{value}</dd>
    </div>
  );
}

// Linha do breakdown: operador (+/−/=) + rótulo + valor.
function CalcRow({ op, label, value, strong }: { op?: '+' | '−' | '='; label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="font-mono text-[11px] uppercase tracking-wider flex items-baseline gap-1.5">
        <span className={`w-2 text-center ${op === '=' ? 'text-sonar' : 'text-muted'}`}>{op ?? ''}</span>
        <span className={strong ? 'text-text-dim' : 'text-muted'}>{label}</span>
      </span>
      <span className={`font-mono tabular-nums ${strong ? 'text-text text-base' : 'text-text-dim text-sm'}`}>{value}</span>
    </div>
  );
}

/**
 * Registrar pagamento — um campo (pré-preenchido com o devido) + um botão com confirmação.
 * Deixar o valor cheio quita (total); reduzir registra pagamento parcial.
 */
function PaymentBox({ amountDue, pending, onPay }: { amountDue: string; pending: boolean; onPay: (input: { amount?: string; full?: boolean }) => void }) {
  const [amount, setAmount] = useState(amountDue);
  const due = Number(amountDue);
  const val = Number(amount);
  const isFull = Number.isFinite(val) && val >= due;
  const valid = Number.isFinite(val) && val > 0;

  function submit(): void {
    if (!valid) return;
    const label = isFull ? 'Quitar esta operação (pagamento total)?' : `Registrar pagamento de ${formatBRL(amount)}?`;
    if (!window.confirm(label)) return;
    onPay(isFull ? { full: true } : { amount });
  }

  return (
    <div className="mt-5 pt-5 border-t border-line">
      <p className="font-mono text-[10px] text-muted uppercase tracking-widest mb-2">Registrar pagamento</p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted">R$</span>
          <input
            type="number" inputMode="decimal" min="0" step="0.01" value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Valor do pagamento"
            className="w-full bg-surface2 border border-line rounded-lg pl-9 pr-3 py-2.5 text-text font-mono text-sm tabular-nums focus:outline-none focus:border-sonar focus:shadow-glow transition-all"
          />
        </div>
        <button
          type="button" onClick={submit} disabled={pending || !valid}
          className="bg-sonar text-ink font-mono text-xs font-semibold uppercase tracking-widest px-4 rounded-lg shadow-[0_8px_24px_-10px_rgb(var(--sonar)/0.7)] hover:brightness-110 active:translate-y-px disabled:opacity-50 disabled:shadow-none transition-all whitespace-nowrap"
        >
          {pending ? 'Salvando…' : isFull ? 'Quitar' : 'Abater'}
        </button>
      </div>
      <p className="font-mono text-[10px] text-muted mt-1.5">
        {isFull ? 'valor cheio → quita a operação' : 'valor parcial → abate do total devido'}
      </p>
    </div>
  );
}

function SituacaoAtual({ s, principal, pending, onPay }: { s: DebtSummary; principal: string; pending: boolean; onPay: (i: { amount?: string; full?: boolean }) => void }) {
  const hasPaid = Number(s.paidAmount) > 0;
  return (
    <>
      {s.settled ? (
        <div className="mb-3">
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border border-status-green/40 bg-status-green/10 text-status-green">
            <span className="w-1.5 h-1.5 rounded-full bg-status-green" /> Quitada
          </span>
        </div>
      ) : null}
      <p className="font-mono text-[10px] text-muted uppercase tracking-widest mb-1">{s.settled ? 'Valor quitado' : 'Devido agora'}</p>
      <p className={`font-mono text-3xl font-medium tabular-nums tracking-tight ${s.settled ? 'text-status-green' : 'text-text'}`}>
        {formatBRL(s.settled ? s.paidAmount : s.amountDue)}
      </p>
      <p className="font-mono text-[11px] text-muted mt-1">{venceEm(s.daysRemaining)}</p>

      {/* Breakdown: original + juros = atual (− pago = devido) */}
      <div className="mt-4 space-y-1.5">
        <CalcRow label="Valor original" value={formatBRL(principal)} />
        <CalcRow op="+" label="Juros acumulados" value={formatBRL(s.accruedInterest)} />
        <CalcRow op="=" label="Valor atual" value={formatBRL(s.balance)} strong={!hasPaid} />
        {hasPaid ? (
          <>
            <CalcRow op="−" label="Pago" value={formatBRL(s.paidAmount)} />
            <CalcRow op="=" label="Devido agora" value={formatBRL(s.amountDue)} strong />
          </>
        ) : null}
      </div>

      {/* Projeção do saldo (bruto, sem abatimentos) */}
      <div className="mt-5">
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

      {!s.settled ? <PaymentBox amountDue={s.amountDue} pending={pending} onPay={onPay} /> : null}
    </>
  );
}

export default function OperacaoDetalhePage({ params }: { params: { id: string } }) {
  const debt = useDebt(params.id);
  const summary = useDebtSummary(params.id);
  const history = useDebtHistory(params.id);
  const setTags = useSetDebtTags(params.id);
  const pay = usePayDebt(params.id);

  const loading = debt.isLoading;

  return (
    <Shell title="Operação">
      <div className="max-w-4xl">
        <Link href="/carteira" className="inline-block font-mono text-[11px] text-muted hover:text-sonar uppercase tracking-widest mb-4">
          ← Carteira
        </Link>

        {loading ? (
          <div className="panel p-6 space-y-4">
            <Skeleton className="h-6 w-52 rounded" />
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ) : debt.isError || !debt.data ? (
          <ErrorState message="Não foi possível carregar esta operação." />
        ) : (
          <div className="space-y-6">
            {/* Cabeçalho */}
            <header className="panel p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-mono text-[10px] text-muted uppercase tracking-[0.18em] mb-1">Devedor</p>
                  <h2 className="font-display text-2xl font-semibold text-text tracking-tight">{debt.data.debtorName}</h2>
                  {debt.data.description ? <p className="font-sans text-sm text-text-dim mt-1">{debt.data.description}</p> : null}
                </div>
                <span className="inline-flex items-center gap-2 font-mono text-xs text-muted">
                  <span className={`w-2 h-2 rounded-full ${STATUS_COLOR[debt.data.status]}`} />
                  {STATUS_LABEL[debt.data.status]}
                </span>
              </div>

              {/* Etiquetas */}
              <div className="mt-5">
                <p className="font-mono text-[10px] text-muted uppercase tracking-widest mb-2">Etiquetas</p>
                <TagInput value={debt.data.tags} onChange={(tags) => setTags.mutate(tags)} />
                {setTags.isError ? (
                  <p role="alert" className="font-mono text-[10px] text-status-red mt-1.5">Não foi possível salvar as etiquetas.</p>
                ) : setTags.isPending ? (
                  <p className="font-mono text-[10px] text-muted mt-1.5">salvando…</p>
                ) : null}
              </div>
            </header>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Situação atual */}
              <section className="panel p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h3 className="font-mono text-xs text-muted uppercase tracking-widest">Situação atual</h3>
                  {summary.data ? <RiskBadge recoverability={summary.data.scores.recoverability} /> : null}
                </div>
                {summary.isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-4 w-full rounded" />)}
                  </div>
                ) : summary.isError || !summary.data ? (
                  <p className="font-sans text-sm text-text-dim">Cálculo indisponível.</p>
                ) : (
                  <SituacaoAtual s={summary.data} principal={debt.data.principal} pending={pay.isPending} onPay={(i) => pay.mutate(i)} />
                )}
                {pay.isError ? <p role="alert" className="font-mono text-[10px] text-status-red mt-2">Não foi possível registrar o pagamento.</p> : null}
              </section>

              {/* Termos */}
              <section className="panel p-6">
                <h3 className="font-mono text-xs text-muted uppercase tracking-widest mb-4">Termos da operação</h3>
                <dl className="space-y-3">
                  <Field label="Principal" value={formatBRL(debt.data.principal)} />
                  <Field label="Taxa" value={`${(Number(debt.data.rate) * 100).toLocaleString('pt-BR')}% ${RATE_PERIOD_LABEL[debt.data.ratePeriod]}`} />
                  <Field label="Início" value={new Date(debt.data.startDate).toLocaleDateString('pt-BR')} />
                  <Field label="Vencimento" value={new Date(debt.data.dueDate).toLocaleDateString('pt-BR')} />
                  <Field label="Moeda" value={debt.data.currency} />
                </dl>
              </section>
            </div>

            {/* Histórico */}
            <section className="panel p-6">
              <h3 className="font-mono text-xs text-muted uppercase tracking-widest mb-5">Histórico da operação</h3>
              {history.isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="w-6 h-6 rounded-full shrink-0" />
                      <Skeleton className="h-4 w-48 rounded" />
                    </div>
                  ))}
                </div>
              ) : history.isError ? (
                <p className="font-sans text-sm text-text-dim">Não foi possível carregar o histórico.</p>
              ) : (
                <Timeline events={history.data ?? []} />
              )}
            </section>
          </div>
        )}
      </div>
    </Shell>
  );
}

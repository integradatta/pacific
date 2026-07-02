'use client';

import { useMemo, useState } from 'react';
import { Decimal } from 'decimal.js';
import Link from 'next/link';
import type { PortfolioRow } from '@pacific/shared';
import { Shell } from '@/components/Shell';
import { usePortfolio } from '@/lib/hooks';
import { formatBRL } from '@/lib/format';
import { ListSkeleton } from '@/components/Skeleton';
import { ErrorState, EmptyState } from '@/components/States';
import { CashForecastCard } from '@/components/CashForecastCard';

const MONTHS_AHEAD = 12;
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (d: Date) => d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

interface MonthBucket { key: string; label: string; total: Decimal; rows: PortfolioRow[] }

function build(rows: PortfolioRow[], now: Date): { overdue: PortfolioRow[]; months: MonthBucket[]; totalOpen: Decimal; next30: Decimal } {
  const today = startOfDay(now);
  const open = rows.filter((r) => !r.settled && new Decimal(r.amountDue).greaterThan(0));
  const overdue = open.filter((r) => startOfDay(new Date(r.dueDate)) < today).sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate));
  const future = open.filter((r) => startOfDay(new Date(r.dueDate)) >= today);

  // 12 meses fixos a partir do atual (meses vazios aparecem → sensação de calendário).
  const months: MonthBucket[] = [];
  for (let i = 0; i < MONTHS_AHEAD; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push({ key: monthKey(d), label: monthLabel(d), total: new Decimal(0), rows: [] });
  }
  const byKey = new Map(months.map((m) => [m.key, m]));
  for (const r of future) {
    const m = byKey.get(monthKey(new Date(r.dueDate)));
    if (m) {
      m.total = m.total.plus(r.amountDue);
      m.rows.push(r);
    }
  }
  for (const m of months) m.rows.sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate));

  const totalOpen = open.reduce((a, r) => a.plus(r.amountDue), new Decimal(0));
  const in30 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30);
  const next30 = future.filter((r) => startOfDay(new Date(r.dueDate)) <= in30).reduce((a, r) => a.plus(r.amountDue), new Decimal(0));
  return { overdue, months, totalOpen, next30 };
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'red' }) {
  return (
    <div className="panel p-4 sm:p-5 min-w-0">
      <p className="font-mono text-[10px] text-muted uppercase tracking-widest mb-2">{label}</p>
      <p className={`font-mono text-xl sm:text-2xl font-medium tabular-nums tracking-tight break-words ${tone === 'red' ? 'text-status-red' : 'text-text'}`}>{value}</p>
    </div>
  );
}

function MonthRow({ m, max }: { m: MonthBucket; max: number }) {
  const [open, setOpen] = useState(false);
  const pct = max > 0 ? Math.round((Number(m.total) / max) * 100) : 0;
  const empty = m.rows.length === 0;
  return (
    <li className="border-t border-line/70 first:border-t-0">
      <button
        type="button" onClick={() => !empty && setOpen((v) => !v)} disabled={empty}
        className={`w-full flex items-center gap-4 px-4 sm:px-6 py-3 text-left ${empty ? 'opacity-50 cursor-default' : 'hover:bg-sonar/[0.03]'} transition-colors`}
      >
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted w-14 shrink-0">{m.label}</span>
        <span className="flex-1 h-2 rounded-full bg-line overflow-hidden min-w-0">
          <span className="block h-full bg-sonar" style={{ width: `${pct}%` }} />
        </span>
        <span className="font-mono text-sm text-text tabular-nums w-28 text-right shrink-0">{formatBRL(m.total.toFixed(2))}</span>
        <span className="font-mono text-[10px] text-muted tabular-nums w-8 text-right shrink-0">{empty ? '—' : m.rows.length}</span>
      </button>
      {open && !empty && (
        <ul className="bg-surface2/40 divide-y divide-line/50">
          {m.rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 sm:px-6 py-2.5 pl-[4.5rem]">
              <Link href={`/operacoes/${r.id}`} className="font-sans text-sm text-text-dim hover:text-sonar truncate transition-colors">{r.debtorName}</Link>
              <span className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-[11px] text-muted tabular-nums">{new Date(r.dueDate).toLocaleDateString('pt-BR')}</span>
                <span className="font-mono text-sm text-text tabular-nums">{formatBRL(r.amountDue)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function RecebiveisPage() {
  const portfolio = usePortfolio();
  const data = useMemo(() => build(portfolio.data ?? [], new Date()), [portfolio.data]);
  const maxMonth = Math.max(0, ...data.months.map((m) => Number(m.total)));

  return (
    <Shell title="Recebíveis">
      {portfolio.isLoading ? (
        <div className="max-w-3xl"><ListSkeleton rows={5} /></div>
      ) : portfolio.isError ? (
        <div className="max-w-3xl"><ErrorState message="Não foi possível carregar os recebíveis." /></div>
      ) : (portfolio.data ?? []).filter((r) => !r.settled).length === 0 ? (
        <EmptyState glyph="▦" title="Nada a receber no momento." hint="cadastre ajudas em aberto para ver o fluxo por mês" />
      ) : (
        <div className="space-y-5 max-w-3xl">
          {/* #4 Previsão ponderada por probabilidade */}
          <CashForecastCard />

          {/* KPIs de caixa futuro */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Kpi label="Total a receber" value={formatBRL(data.totalOpen.toFixed(2))} />
            <Kpi label="Próximos 30 dias" value={formatBRL(data.next30.toFixed(2))} />
            <Kpi label="Em atraso" value={formatBRL(data.overdue.reduce((a, r) => a.plus(r.amountDue), new Decimal(0)).toFixed(2))} tone={data.overdue.length > 0 ? 'red' : undefined} />
          </div>

          {/* Em atraso (já venceu e segue em aberto) */}
          {data.overdue.length > 0 && (
            <section className="panel overflow-hidden border-status-red/30">
              <div className="px-4 sm:px-6 py-3 border-b border-line flex items-baseline justify-between">
                <h2 className="font-mono text-[11px] uppercase tracking-widest text-status-red">Em atraso</h2>
                <span className="font-mono text-[10px] text-muted tabular-nums">{data.overdue.length}</span>
              </div>
              <ul className="divide-y divide-line/70">
                {data.overdue.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-4 sm:px-6 py-2.5">
                    <Link href={`/operacoes/${r.id}`} className="font-sans text-sm text-text hover:text-sonar truncate transition-colors">{r.debtorName}</Link>
                    <span className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-[11px] text-status-red tabular-nums">venceu {new Date(r.dueDate).toLocaleDateString('pt-BR')}</span>
                      <span className="font-mono text-sm text-text tabular-nums">{formatBRL(r.amountDue)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Calendário de 12 meses */}
          <section className="panel overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-line flex items-baseline justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold text-text tracking-tight">Próximos 12 meses</h2>
                <p className="font-mono text-[10px] text-muted uppercase tracking-[0.18em] mt-0.5">quanto entra por mês (se pago no vencimento)</p>
              </div>
            </div>
            <ul>
              {data.months.map((m) => <MonthRow key={m.key} m={m} max={maxMonth} />)}
            </ul>
          </section>
          <p className="font-mono text-[10px] text-muted tracking-wider">Considera o valor devido hoje de cada operação em aberto, somado no mês do vencimento. Toque num mês para ver as operações.</p>
        </div>
      )}
    </Shell>
  );
}

'use client';

import { Shell } from '@/components/Shell';
import { usePortfolio } from '@/lib/hooks';
import type { PortfolioRow } from '@pacific/shared';
import { formatBRL, venceEm } from '@/lib/format';
import { STATUS_COLOR } from '@/lib/status';
import { ListSkeleton } from '@/components/Skeleton';
import { ErrorState } from '@/components/States';

const BUCKETS: { label: string; test: (d: number) => boolean; accent: string }[] = [
  { label: 'Vencidos', test: (d) => d < 0, accent: 'text-status-red' },
  { label: 'Próximos 7 dias', test: (d) => d >= 0 && d <= 7, accent: 'text-status-orange' },
  { label: '8 a 15 dias', test: (d) => d > 7 && d <= 15, accent: 'text-status-yellow' },
  { label: '16 a 30 dias', test: (d) => d > 15 && d <= 30, accent: 'text-status-yellow' },
  { label: 'Mais de 30 dias', test: (d) => d > 30, accent: 'text-status-green' },
];

function Row({ r }: { r: PortfolioRow }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-line/70 hover:bg-sonar/[0.03] transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLOR[r.status]}`} />
        <span className="font-sans text-sm text-text truncate">{r.debtorName}</span>
      </div>
      <div className="flex items-center gap-4 font-mono text-xs tabular-nums shrink-0">
        <span className="text-text">{formatBRL(r.balance)}</span>
        <span className="text-muted w-28 text-right">{venceEm(r.daysRemaining)}</span>
      </div>
    </div>
  );
}

export default function VencimentosPage() {
  const portfolio = usePortfolio();
  const rows = portfolio.data ?? [];

  return (
    <Shell title="Radar de Vencimentos">
      {portfolio.isLoading ? (
        <div className="max-w-3xl"><ListSkeleton rows={4} /></div>
      ) : portfolio.isError ? (
        <div className="max-w-3xl"><ErrorState message="Não foi possível carregar os vencimentos." /></div>
      ) : (
        <div className="space-y-4 max-w-3xl">
          {BUCKETS.map((b) => {
            const items = rows.filter((r) => b.test(r.daysRemaining));
            return (
              <section key={b.label} className="panel overflow-hidden">
                <div className="px-4 py-3 border-b border-line flex items-baseline justify-between">
                  <h2 className={`font-mono text-[11px] uppercase tracking-widest ${b.accent}`}>{b.label}</h2>
                  <span className="font-mono text-[10px] text-muted tabular-nums">{items.length}</span>
                </div>
                {items.length === 0 ? (
                  <p className="px-4 py-3 font-mono text-xs text-muted">—</p>
                ) : (
                  items.map((r) => <Row key={r.id} r={r} />)
                )}
              </section>
            );
          })}
        </div>
      )}
    </Shell>
  );
}

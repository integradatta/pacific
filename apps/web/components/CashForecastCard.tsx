'use client';

import { useCashForecast } from '@/lib/insights';
import { formatBRL } from '@/lib/format';

// #4 Previsão de caixa PONDERADA — compacto. Destaca "provável" vs nominal (a inteligência).
export function CashForecastCard() {
  const q = useCashForecast();
  const f = q.data;
  if (q.isLoading) return <div className="panel p-5"><div className="skeleton h-16 w-full rounded" /></div>;
  if (!f || f.count === 0) return null;

  const pct = f.nominal > 0 ? Math.round((f.expected / f.nominal) * 100) : 0;
  return (
    <section className="panel p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-mono text-xs text-muted uppercase tracking-widest">Previsão ponderada · 90 dias</h3>
        <span className="font-mono text-[10px] text-muted tabular-nums">{pct}% do nominal</span>
      </div>
      <p className="font-display text-3xl font-semibold text-text tracking-tight mt-2 tabular-nums">{formatBRL(String(f.expected))}</p>
      <p className="font-sans text-sm text-text-dim mt-0.5">
        provável, de <span className="tabular-nums">{formatBRL(String(f.nominal))}</span> previstos
      </p>
      {/* faixa pessimista → otimista */}
      <div className="mt-3">
        <div className="relative h-1.5 rounded-full bg-surface2 overflow-hidden">
          <span className="absolute inset-y-0 rounded-full bg-sonar/70" style={{ left: `${f.optimistic > 0 ? (f.pessimistic / f.optimistic) * 100 : 0}%`, right: `0%` }} />
          <span className="absolute inset-y-0 left-0 rounded-full bg-sonar" style={{ width: `${f.optimistic > 0 ? (f.expected / f.optimistic) * 100 : 0}%` }} />
        </div>
        <div className="flex justify-between font-mono text-[10px] text-muted mt-1.5 tabular-nums">
          <span>pessimista {formatBRL(String(f.pessimistic))}</span>
          <span>otimista {formatBRL(String(f.optimistic))}</span>
        </div>
      </div>
    </section>
  );
}

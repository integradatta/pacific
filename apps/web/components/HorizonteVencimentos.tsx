'use client';

import type { PortfolioRow } from '@pacific/shared';
import { STATUS_COLOR } from '@/lib/status';
import { venceEm } from '@/lib/format';

// Assinatura visual: cada dívida é um "contato" posicionado por dias restantes.
// Faixa de vencidos à esquerda, escala ativa 0..30d, bucket +30d à direita.
function xPercent(days: number): number {
  if (days < 0) return 3 + (Math.abs(days) % 5);
  if (days > 30) return 94;
  return 12 + (days / 30) * 78;
}

const TICKS = [
  { label: 'hoje', days: 0 },
  { label: '7d', days: 7 },
  { label: '15d', days: 15 },
  { label: '30d', days: 30 },
];

export function HorizonteVencimentos({ rows }: { rows: PortfolioRow[] }) {
  return (
    <section className="bg-surface border border-line rounded-xl p-6">
      <div className="flex items-baseline justify-between mb-6">
        <h2 className="font-display text-lg font-semibold text-text tracking-tight">Horizonte de Vencimentos</h2>
        <span className="font-mono text-[10px] text-muted uppercase tracking-widest">{rows.length} contatos</span>
      </div>

      <div className="relative h-28">
        {/* faixa de vencidos */}
        <div
          className="absolute inset-y-0 left-0 w-[9%] border-r border-dashed border-status-red/30 bg-status-red/5 rounded-l"
          aria-hidden
        />
        {/* gridlines */}
        {TICKS.map((t) => (
          <div
            key={t.label}
            className="absolute inset-y-0 w-px bg-line"
            style={{ left: `${xPercent(t.days)}%` }}
            aria-hidden
          />
        ))}
        {/* baseline */}
        <div className="absolute left-0 right-0 top-1/2 h-px bg-line" aria-hidden />
        {/* contatos */}
        {rows.map((r, i) => (
          <span
            key={r.id}
            title={`${r.debtorName} · ${venceEm(r.daysRemaining)}`}
            className={`absolute -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ring-2 ring-ink ${STATUS_COLOR[r.status]}`}
            style={{ left: `${xPercent(r.daysRemaining)}%`, top: `${26 + (i % 4) * 16}%` }}
          />
        ))}
      </div>

      {/* eixo de rótulos */}
      <div className="relative h-4 mt-1">
        <span className="absolute left-0 font-mono text-[10px] text-status-red/70 uppercase tracking-wider">vencidos</span>
        {TICKS.map((t) => (
          <span
            key={t.label}
            className="absolute -translate-x-1/2 font-mono text-[10px] text-muted tracking-wider"
            style={{ left: `${xPercent(t.days)}%` }}
          >
            {t.label}
          </span>
        ))}
        <span className="absolute right-0 font-mono text-[10px] text-muted tracking-wider">+30d</span>
      </div>
    </section>
  );
}

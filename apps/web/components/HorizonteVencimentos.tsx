'use client';

import type { DebtStatus, PortfolioRow } from '@pacific/shared';
import { venceEm } from '@/lib/format';

// Assinatura visual: cada dívida é um "contato" no sonar, posicionado por dias restantes.
// Faixa de vencidos à esquerda, escala ativa 0..30d, bucket +30d à direita.
function xPercent(days: number): number {
  if (days < 0) return 3 + (Math.abs(days) % 5);
  if (days > 30) return 94;
  return 12 + (days / 30) * 78;
}

// Canal RGB por status — para o glow do blip (box-shadow inline).
const STATUS_RGB: Record<DebtStatus, string> = {
  GREEN: 'var(--green)',
  YELLOW: 'var(--yellow)',
  ORANGE: 'var(--orange)',
  RED: 'var(--red)',
};

const TICKS = [
  { label: 'hoje', days: 0 },
  { label: '7d', days: 7 },
  { label: '15d', days: 15 },
  { label: '30d', days: 30 },
];

export function HorizonteVencimentos({ rows }: { rows: PortfolioRow[] }) {
  return (
    <section className="panel p-6">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h2 className="font-display text-lg font-semibold text-text tracking-tight">Horizonte de Vencimentos</h2>
          <p className="font-mono text-[10px] text-muted uppercase tracking-[0.18em] mt-0.5">varredura por dias restantes</p>
        </div>
        <span className="font-mono text-[10px] text-muted uppercase tracking-widest tabular-nums">{rows.length} contatos</span>
      </div>

      <div className="relative h-28 overflow-hidden rounded-lg">
        {/* piso do sonar: profundidade radial a partir do "hoje" */}
        <div
          className="absolute inset-0 rounded-lg"
          style={{ background: 'radial-gradient(120% 140% at 12% 50%, rgb(var(--sonar) / 0.07), transparent 55%)' }}
          aria-hidden
        />
        {/* faixa de vencidos */}
        <div
          className="absolute inset-y-0 left-0 w-[9%] border-r border-dashed border-status-red/30 bg-status-red/[0.06] rounded-l-lg"
          aria-hidden
        />
        {/* gridlines */}
        {TICKS.map((t) => (
          <div
            key={t.label}
            className={`absolute inset-y-0 w-px ${t.days === 0 ? 'bg-sonar/30 shadow-[0_0_8px_0_rgb(var(--sonar)/0.5)]' : 'bg-line'}`}
            style={{ left: `${xPercent(t.days)}%` }}
            aria-hidden
          />
        ))}
        {/* baseline */}
        <div className="absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-line via-line-strong to-transparent" aria-hidden />
        {/* sweep do sonar */}
        <div
          className="absolute inset-y-0 w-24 animate-sweep pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, rgb(var(--sonar) / 0.10), rgb(var(--sonar) / 0.02), transparent)' }}
          aria-hidden
        />
        {/* contatos */}
        {rows.map((r, i) => {
          const rgb = STATUS_RGB[r.status];
          return (
            <span
              key={r.id}
              title={`${r.debtorName} · ${venceEm(r.daysRemaining)}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ring-2 ring-ink"
              style={{
                left: `${xPercent(r.daysRemaining)}%`,
                top: `${26 + (i % 4) * 16}%`,
                background: `rgb(${rgb})`,
                boxShadow: `0 0 10px -1px rgb(${rgb} / 0.8)`,
              }}
            >
              {/* ping nos vencidos */}
              {r.status === 'RED' && (
                <span
                  className="absolute inset-0 rounded-full animate-ping2"
                  style={{ background: `rgb(${rgb} / 0.5)` }}
                  aria-hidden
                />
              )}
            </span>
          );
        })}
      </div>

      {/* eixo de rótulos */}
      <div className="relative h-4 mt-2">
        <span className="absolute left-0 font-mono text-[10px] text-status-red/70 uppercase tracking-wider">vencidos</span>
        {TICKS.map((t) => (
          <span
            key={t.label}
            className={`absolute -translate-x-1/2 font-mono text-[10px] tracking-wider ${t.days === 0 ? 'text-sonar' : 'text-muted'}`}
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

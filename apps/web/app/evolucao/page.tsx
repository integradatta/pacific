'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { portfolioTrend, weeklySummary, tagSegments, type WeeklyPoint, type TagSegment, type PortfolioRow } from '@pacific/shared';
import { Shell } from '@/components/Shell';
import { useEvolution, usePortfolio } from '@/lib/hooks';
import { useRenegotiation } from '@/lib/insights';
import { formatBRL } from '@/lib/format';
import { ListSkeleton } from '@/components/Skeleton';
import { ErrorState, EmptyState } from '@/components/States';

const TREND = {
  IMPROVING: { icon: '↑', label: 'Melhorando', cls: 'text-status-green border-status-green/40' },
  STABLE: { icon: '→', label: 'Estável', cls: 'text-muted border-line' },
  WORSENING: { icon: '↓', label: 'Piorando', cls: 'text-status-red border-status-red/40' },
} as const;

// Curva simples de saúde (0–100) — SVG leve, sem lib de gráfico no bundle.
function HealthCurve({ points }: { points: WeeklyPoint[] }) {
  const W = 640;
  const H = 120;
  const pad = 8;
  const n = points.length;
  const x = (i: number) => (n <= 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (n - 1));
  const y = (score: number) => H - pad - (Math.max(0, Math.min(100, score)) / 100) * (H - 2 * pad);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.healthScore).toFixed(1)}`).join(' ');
  const area = `${line} L ${x(n - 1).toFixed(1)} ${H - pad} L ${x(0).toFixed(1)} ${H - pad} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28" preserveAspectRatio="none" role="img" aria-label="Curva de saúde da carteira">
      <defs>
        <linearGradient id="hc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(var(--sonar) / 0.25)" />
          <stop offset="100%" stopColor="rgb(var(--sonar) / 0)" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#hc)" />
      <path d={line} fill="none" stroke="rgb(var(--sonar))" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.healthScore)} r={2.5} fill="rgb(var(--sonar))" />)}
    </svg>
  );
}

function TrendSection({ series }: { series: WeeklyPoint[] }) {
  // API devolve desc (recente→antigo); a curva e as leituras usam ordem cronológica.
  const asc = useMemo(() => [...series].reverse(), [series]);
  if (asc.length < 2) {
    return (
      <section className="panel p-6">
        <h2 className="font-mono text-xs text-muted uppercase tracking-widest mb-2">Saúde ao longo do tempo</h2>
        <p className="font-sans text-sm text-text-dim">A curva aparece nas próximas semanas — um retrato é capturado a cada semana. {asc.length === 1 ? `Score atual: ${asc[0]!.healthScore}.` : ''}</p>
      </section>
    );
  }
  const trend = portfolioTrend(asc);
  const t = TREND[trend.direction];
  const first = asc[0]!.healthScore;
  const last = asc[asc.length - 1]!.healthScore;
  const delta = last - first;
  return (
    <section className="panel p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-mono text-xs text-muted uppercase tracking-widest">Saúde ao longo do tempo</h2>
          <p className="font-display text-3xl font-semibold text-text tabular-nums mt-1">{last}<span className="text-base text-muted font-normal">/100</span></p>
        </div>
        <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest px-2.5 py-1 rounded-full border ${t.cls}`}>{t.icon} {t.label}</span>
      </div>
      <HealthCurve points={asc} />
      <p className="font-sans text-sm text-text-dim mt-4 leading-relaxed">
        {weeklySummary(asc)}{' '}
        {Math.abs(delta) >= 8 && (
          <span className={delta < 0 ? 'text-status-red' : 'text-status-green'}>
            {delta < 0 ? `A saúde caiu ${Math.abs(delta)} pontos nesse período — vale olhar o que mudou.` : `A saúde subiu ${delta} pontos nesse período.`}
          </span>
        )}
      </p>
      <p className="font-mono text-[10px] text-muted tracking-wider mt-3">{asc.length} semanas · da mais antiga à atual</p>
    </section>
  );
}

function SegmentReading({ segs }: { segs: TagSegment[] }) {
  // Destaca (leitura, sem alarme) a etiqueta material que paga pior — onde vale afinar a originação.
  const material = segs.filter((s) => s.opsCount >= 2 && s.tag !== 'sem etiqueta');
  if (material.length < 2) return null;
  const worst = [...material].sort((a, b) => a.avgPaymentProbability - b.avgPaymentProbability)[0]!;
  const best = [...material].sort((a, b) => b.avgPaymentProbability - a.avgPaymentProbability)[0]!;
  if (worst.tag === best.tag || best.avgPaymentProbability - worst.avgPaymentProbability < 12) return null;
  return (
    <p className="font-sans text-sm text-text-dim leading-relaxed">
      No seu histórico, <span className="text-text font-medium">“{best.tag}”</span> tende a pagar melhor ({best.avgPaymentProbability}%) que{' '}
      <span className="text-text font-medium">“{worst.tag}”</span> ({worst.avgPaymentProbability}%). Um sinal de onde a carteira responde melhor — você decide como usar.
    </p>
  );
}

function SegmentsSection({ rows }: { rows: PortfolioRow[] }) {
  const segs = tagSegments(rows);
  const maxExposure = Math.max(1, ...segs.map((s) => Number(s.exposure)));
  if (segs.length === 0) {
    return (
      <section className="panel p-6">
        <h2 className="font-mono text-xs text-muted uppercase tracking-widest mb-2">Segmentos por etiqueta</h2>
        <p className="font-sans text-sm text-text-dim">Etiquete suas operações (na tela de cada ajuda) para ver a performance por segmento.</p>
      </section>
    );
  }
  return (
    <section className="panel overflow-hidden">
      <div className="px-6 py-4 border-b border-line">
        <h2 className="font-display text-lg font-semibold text-text tracking-tight">Segmentos por etiqueta</h2>
        <p className="font-mono text-[10px] text-muted uppercase tracking-[0.18em] mt-0.5">como cada etiqueta se comporta na carteira em aberto</p>
      </div>
      <div className="px-6 py-4"><SegmentReading segs={segs} /></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr className="font-mono text-[10px] text-muted uppercase tracking-widest border-b border-line">
              <th className="text-left font-normal px-6 py-2.5">Etiqueta</th>
              <th className="text-right font-normal px-6 py-2.5">Exposição</th>
              <th className="text-right font-normal px-6 py-2.5">Ops</th>
              <th className="text-right font-normal px-6 py-2.5">Vencidas</th>
              <th className="text-right font-normal px-6 py-2.5">Prob. média</th>
            </tr>
          </thead>
          <tbody>
            {segs.map((s) => (
              <tr key={s.tag} className="border-t border-line/70">
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-sans text-sm text-text">{s.tag}</span>
                    <span className="font-mono text-[10px] text-muted tabular-nums">{s.sharePct}%</span>
                  </div>
                  <span className="mt-1.5 block h-1 rounded-full bg-line overflow-hidden max-w-[160px]">
                    <span className="block h-full bg-sonar" style={{ width: `${Math.round((Number(s.exposure) / maxExposure) * 100)}%` }} />
                  </span>
                </td>
                <td className="px-6 py-3 text-right font-mono text-sm text-text tabular-nums">{formatBRL(s.exposure)}</td>
                <td className="px-6 py-3 text-right font-mono text-sm text-text-dim tabular-nums">{s.opsCount}</td>
                <td className={`px-6 py-3 text-right font-mono text-sm tabular-nums ${s.overdueCount > 0 ? 'text-status-red' : 'text-text-dim'}`}>{s.overdueCount}</td>
                <td className="px-6 py-3 text-right font-mono text-sm text-text tabular-nums">{s.avgPaymentProbability}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// P10 — leitura da eficácia de renegociação (só com histórico material, ≥3).
function RenegotiationCard() {
  const q = useRenegotiation();
  const d = q.data;
  if (!d || d.total < 3) return null;
  const pctSettled = Math.round((d.settled / d.total) * 100);
  return (
    <section className="panel p-6">
      <h2 className="font-mono text-xs text-muted uppercase tracking-widest mb-2">Renegociar tem funcionado?</h2>
      <p className="font-sans text-sm text-text-dim leading-relaxed">
        Das <span className="text-text font-medium">{d.total}</span> operações que você renegociou,{' '}
        <span className="text-text font-medium">{d.settled}</span> já foram quitadas ({pctSettled}%)
        {d.settled > 0 ? <> — <span className="text-status-green">{d.onTime} no novo prazo</span></> : null}.
        {' '}Um sinal de quando vale propor um novo combinado; a decisão é sua.
      </p>
    </section>
  );
}

export default function EvolucaoPage() {
  const evolution = useEvolution();
  const portfolio = usePortfolio();

  return (
    <Shell title="Evolução">
      <div className="max-w-3xl space-y-5">
        <p className="font-sans text-sm text-text-dim">
          Como a carteira se comporta ao longo do tempo e por segmento — a leitura de gestão, além da foto de hoje.
        </p>

        {evolution.isLoading ? (
          <ListSkeleton rows={3} />
        ) : evolution.isError ? (
          <ErrorState message="Não foi possível carregar a evolução." />
        ) : (
          <TrendSection series={evolution.data ?? []} />
        )}

        <RenegotiationCard />

        {portfolio.isLoading ? (
          <ListSkeleton rows={3} />
        ) : portfolio.isError ? (
          <ErrorState message="Não foi possível carregar os segmentos." />
        ) : (portfolio.data ?? []).filter((r) => !r.settled).length === 0 ? (
          <EmptyState glyph="△" title="Sem operações em aberto." hint="cadastre ajudas para ver a evolução e os segmentos" />
        ) : (
          <SegmentsSection rows={portfolio.data ?? []} />
        )}
      </div>
    </Shell>
  );
}

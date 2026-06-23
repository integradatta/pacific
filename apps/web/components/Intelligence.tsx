'use client';

import Link from 'next/link';
import type {
  PortfolioIntelligence,
  PortfolioHealth,
  Insight,
  InsightFilter,
  ActionItem,
  Concentration,
  ClientAggregate,
  Rankings as RankingsT,
  PortfolioTrend,
  IntelligenceThresholds,
} from '@pacific/shared';
import { DEFAULT_THRESHOLDS } from '@pacific/shared';
import { formatBRL } from '@/lib/format';

const TREND = {
  IMPROVING: { icon: '📈', label: 'Melhorando', cls: 'text-status-green border-status-green/40' },
  STABLE: { icon: '➖', label: 'Estável', cls: 'text-muted border-line' },
  WORSENING: { icon: '📉', label: 'Piorando', cls: 'text-status-red border-status-red/40' },
} as const;

const STATE_BAR = { HEALTHY: 'bg-status-green', ATTENTION: 'bg-status-yellow', CRITICAL: 'bg-status-red' } as const;

const HEALTH = {
  HEALTHY: { label: 'Saudável', icon: '🟢', text: 'text-status-green', bg: 'bg-status-green', ring: 'border-status-green/40', soft: 'bg-status-green/10' },
  ATTENTION: { label: 'Atenção', icon: '🟡', text: 'text-status-yellow', bg: 'bg-status-yellow', ring: 'border-status-yellow/40', soft: 'bg-status-yellow/10' },
  CRITICAL: { label: 'Crítica', icon: '🔴', text: 'text-status-red', bg: 'bg-status-red', ring: 'border-status-red/40', soft: 'bg-status-red/10' },
} as const;

// Insight/ação → link para a carteira filtrada.
function filterHref(f: InsightFilter): string {
  switch (f.kind) {
    case 'overdue': return '/carteira?status=RED';
    case 'dueSoon': return '/carteira?status=ORANGE';
    case 'highRisk': return '/carteira?risk=HIGH';
    case 'client': return `/carteira?q=${encodeURIComponent(f.name)}`;
    default: return '/carteira';
  }
}

const TONE: Record<Insight['tone'], string> = {
  good: 'text-status-green border-status-green/30 hover:bg-status-green/10',
  info: 'text-sonar border-sonar/30 hover:bg-sonar/10',
  warn: 'text-status-yellow border-status-yellow/30 hover:bg-status-yellow/10',
  danger: 'text-status-red border-status-red/30 hover:bg-status-red/10',
};

/** Hero: saúde da carteira (indicador único) + resumo executivo automático. */
export function HealthHero({ health, summary }: { health: PortfolioHealth; summary: string }) {
  const h = HEALTH[health.state];
  return (
    <section className={`panel p-6 border ${h.ring} ${h.soft}`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-6">
        {/* Indicador */}
        <div className="flex items-center gap-4 shrink-0">
          <div className={`relative w-20 h-20 rounded-full ${h.soft} border ${h.ring} flex items-center justify-center`}>
            <span className="font-mono text-2xl font-semibold tabular-nums text-text">{health.score}</span>
          </div>
          <div>
            <p className="font-mono text-[10px] text-muted uppercase tracking-widest mb-1">Saúde da carteira</p>
            <p className={`font-display text-2xl font-semibold tracking-tight ${h.text}`}>{h.label}</p>
          </div>
        </div>
        {/* Resumo + fatores */}
        <div className="flex-1 min-w-0">
          <p className="font-sans text-sm text-text-dim leading-relaxed">{summary}</p>
          {health.factors.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-3">
              {health.factors.map((f) => (
                <span key={f.label} className="font-mono text-[10px] text-muted uppercase tracking-wider border border-line rounded px-2 py-0.5">
                  {f.label} <span className="text-status-red">−{f.penalty}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Insights automáticos — cada um é clicável e abre a lista filtrada. */
export function InsightStrip({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {insights.map((i) => (
        <Link key={i.id} href={filterHref(i.filter)} className={`panel p-3.5 border flex items-start gap-2.5 transition-colors ${TONE[i.tone]}`}>
          <span className="font-mono text-sm mt-0.5" aria-hidden>◆</span>
          <span className="font-sans text-sm text-text-dim leading-snug">{i.text}</span>
        </Link>
      ))}
    </div>
  );
}

const ACTION_META: Record<ActionItem['kind'], { label: string; dot: string }> = {
  overdue: { label: 'Vencida', dot: 'bg-status-red' },
  concentration: { label: 'Concentração', dot: 'bg-status-yellow' },
  dueSoon: { label: 'Vence em breve', dot: 'bg-status-orange' },
  highRisk: { label: 'Alto risco', dot: 'bg-status-red' },
  highValue: { label: 'Maior exposição', dot: 'bg-sonar' },
};

/** Centro de ação: "O que preciso resolver hoje?" — priorizado. */
export function ActionCenter({ items }: { items: ActionItem[] }) {
  return (
    <section className="panel overflow-hidden">
      <div className="px-6 py-4 border-b border-line flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold text-text tracking-tight">O que preciso resolver hoje?</h2>
        <span className="font-mono text-[10px] text-muted uppercase tracking-widest tabular-nums">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="p-10 text-center">
          <p className="font-mono text-2xl text-muted/60 mb-2" aria-hidden>✓</p>
          <p className="font-sans text-sm text-text-dim">Nada urgente. Sua carteira está sob controle.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line/70 max-h-[28rem] overflow-y-auto">
          {items.slice(0, 12).map((it) => {
            const m = ACTION_META[it.kind];
            const body = (
              <div className="flex items-center justify-between gap-4 px-6 py-3 hover:bg-sonar/[0.03] transition-colors">
                <div className="min-w-0 flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${m.dot}`} aria-hidden />
                  <div className="min-w-0">
                    <p className="font-sans text-sm text-text truncate">{it.client}</p>
                    <p className="font-mono text-[11px] text-muted truncate">{it.reason}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-[9px] text-muted uppercase tracking-widest">{m.label}</p>
                  {it.kind !== 'concentration' && <p className="font-mono text-sm text-text tabular-nums">{formatBRL(it.amountDue)}</p>}
                </div>
              </div>
            );
            return <li key={it.id}>{it.opId ? <Link href={`/operacoes/${it.opId}`}>{body}</Link> : body}</li>;
          })}
        </ul>
      )}
    </section>
  );
}

function Bar({ pct, cls }: { pct: number; cls: string }) {
  return (
    <span className="h-2 flex-1 rounded-full bg-line overflow-hidden">
      <span className={`block h-full ${cls}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </span>
  );
}

/** Concentração + cliente mais importante. */
export function ConcentrationCard({ concentration: c, topClient }: { concentration: Concentration; topClient: ClientAggregate | null }) {
  return (
    <section className="panel p-6 space-y-4">
      <h2 className="font-display text-lg font-semibold text-text tracking-tight">Concentração & dependência</h2>
      {topClient ? (
        <>
          <p className="font-sans text-sm text-text-dim">
            <span className="text-text font-medium">{topClient.name}</span> é seu cliente mais importante: {formatBRL(topClient.exposure)} ({topClient.sharePct}% da exposição) em {topClient.opsCount} {topClient.opsCount === 1 ? 'operação' : 'operações'}.
          </p>
          <div className="space-y-2">
            {[
              { label: '3 maiores', pct: c.top3Pct },
              { label: '5 maiores', pct: c.top5Pct },
              { label: '10 maiores', pct: c.top10Pct },
            ].map((r) => (
              <div key={r.label} className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-muted uppercase tracking-wider w-16">{r.label}</span>
                <Bar pct={r.pct} cls={r.pct >= 50 ? 'bg-status-red' : r.pct >= 30 ? 'bg-status-yellow' : 'bg-sonar'} />
                <span className="font-mono text-xs text-text tabular-nums w-9 text-right">{r.pct}%</span>
              </div>
            ))}
          </div>
          {c.top3Pct >= 40 && (
            <p className="font-mono text-[11px] text-status-yellow border-t border-line pt-3">
              ⚠ Se os 3 maiores clientes atrasarem, {c.top3Pct}% da carteira será impactada.
            </p>
          )}
        </>
      ) : (
        <p className="font-sans text-sm text-text-dim">Sem operações ativas para analisar concentração.</p>
      )}
    </section>
  );
}

function RankCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel overflow-hidden">
      <div className="px-5 py-3 border-b border-line"><h3 className="font-mono text-[11px] text-muted uppercase tracking-widest">{title}</h3></div>
      <ul className="divide-y divide-line/70">{children}</ul>
    </div>
  );
}
function RankRow({ name, primary, secondary, href }: { name: string; primary: string; secondary?: string; href?: string }) {
  const body = (
    <div className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-sonar/[0.03] transition-colors">
      <span className="font-sans text-sm text-text truncate">{name}</span>
      <span className="text-right shrink-0">
        <span className="font-mono text-sm text-text tabular-nums">{primary}</span>
        {secondary && <span className="font-mono text-[10px] text-muted ml-2">{secondary}</span>}
      </span>
    </div>
  );
  return <li>{href ? <Link href={href}>{body}</Link> : body}</li>;
}

/** Rankings: operações mais lucrativas / mais arriscadas + clientes por exposição. */
export function Rankings({ rankings: r }: { rankings: RankingsT }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <RankCard title="Mais lucrativas">
        {r.mostProfitable.length === 0 && <li className="px-5 py-4 font-sans text-sm text-text-dim">—</li>}
        {r.mostProfitable.map((o) => (
          <RankRow key={o.id} name={o.client} primary={formatBRL(o.expectedProfit)} secondary={`${o.profitabilityPct}%`} href={`/operacoes/${o.id}`} />
        ))}
      </RankCard>
      <RankCard title="Mais arriscadas">
        {r.riskiest.length === 0 && <li className="px-5 py-4 font-sans text-sm text-text-dim">—</li>}
        {r.riskiest.map((o) => (
          <RankRow key={o.id} name={o.client} primary={formatBRL(o.amountDue)} secondary={`recup. ${o.recoverability}`} href={`/operacoes/${o.id}`} />
        ))}
      </RankCard>
      <RankCard title="Maiores exposições (clientes)">
        {r.clientsByExposure.length === 0 && <li className="px-5 py-4 font-sans text-sm text-text-dim">—</li>}
        {r.clientsByExposure.map((c) => (
          <RankRow key={c.name} name={c.name} primary={formatBRL(c.exposure)} secondary={`${c.sharePct}%`} href={`/carteira?q=${encodeURIComponent(c.name)}`} />
        ))}
      </RankCard>
    </div>
  );
}

/** Resumo da semana + tendência de risco (📈➖📉) — in-app, sem envio externo. */
export function WeeklyTrend({ trend, summary }: { trend: PortfolioTrend; summary?: string }) {
  const t = TREND[trend.direction];
  const max = Math.max(100, ...trend.series.map((p) => p.healthScore));
  return (
    <section className="panel p-6">
      <div className="flex items-center justify-between gap-4 mb-3">
        <h2 className="font-display text-lg font-semibold text-text tracking-tight">Resumo da semana</h2>
        <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border ${t.cls}`}>
          <span aria-hidden>{t.icon}</span> {t.label}{trend.deltaScore !== 0 && <span className="tabular-nums">{trend.deltaScore > 0 ? `+${trend.deltaScore}` : trend.deltaScore}</span>}
        </span>
      </div>
      {summary && <p className="font-sans text-sm text-text-dim leading-relaxed mb-4">{summary}</p>}
      {trend.series.length > 1 ? (
        <div className="flex items-end gap-1.5 h-16" aria-label="Histórico de saúde da carteira">
          {trend.series.map((p) => (
            <div key={p.weekStart} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${new Date(p.weekStart).toLocaleDateString('pt-BR')}: ${p.healthScore}/100`}>
              <span className={`w-full rounded-sm ${STATE_BAR[p.state]}`} style={{ height: `${Math.max(6, (p.healthScore / max) * 100)}%` }} />
            </div>
          ))}
        </div>
      ) : (
        <p className="font-mono text-[11px] text-muted tracking-wider">A tendência aparece após algumas semanas de uso (1 registro por semana).</p>
      )}
    </section>
  );
}

/** Ajustes de limiares de risco/concentração (configuráveis pelo credor; sem regra fixa). */
export function ThresholdSettings({ thresholds, onChange }: { thresholds: IntelligenceThresholds; onChange: (t: IntelligenceThresholds) => void }) {
  const field = (key: keyof IntelligenceThresholds, label: string, hint: string, min: number, max: number) => (
    <label className="flex items-center justify-between gap-3">
      <span className="font-sans text-sm text-text-dim">{label} <span className="text-muted">· {hint}</span></span>
      <input
        type="number"
        min={min}
        max={max}
        value={thresholds[key]}
        onChange={(e) => onChange({ ...thresholds, [key]: Number(e.target.value) })}
        className="w-20 bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-text font-mono text-sm text-right focus:outline-none focus:border-sonar transition-colors"
      />
    </label>
  );
  return (
    <details className="panel p-0 overflow-hidden group">
      <summary className="px-6 py-3 cursor-pointer flex items-center justify-between list-none">
        <span className="font-mono text-[11px] text-muted uppercase tracking-widest">Ajustes de inteligência</span>
        <span className="font-mono text-[10px] text-muted group-open:rotate-90 transition-transform" aria-hidden>▸</span>
      </summary>
      <div className="px-6 py-4 border-t border-line space-y-3">
        {field('highRiskBelow', 'Alto risco quando recuperabilidade abaixo de', '1–99', 1, 99)}
        {field('concentrationLimitPct', 'Concentração excessiva nos 3 maiores acima de (%)', '10–100', 10, 100)}
        {field('dueSoonDays', 'Janela de "vence em breve" (dias)', '1–60', 1, 60)}
        <button type="button" onClick={() => onChange(DEFAULT_THRESHOLDS)} className="font-mono text-[10px] text-muted hover:text-sonar uppercase tracking-widest">Restaurar padrões</button>
      </div>
    </details>
  );
}

/** Bloco completo de inteligência para o dashboard. */
export function IntelligenceBlock({ intel }: { intel: PortfolioIntelligence }) {
  return (
    <div className="space-y-6">
      <HealthHero health={intel.health} summary={intel.summary} />
      <InsightStrip insights={intel.insights} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <ActionCenter items={intel.actionItems} />
        <div className="space-y-6">
          {intel.trend && <WeeklyTrend trend={intel.trend} summary={intel.weeklySummary} />}
          <ConcentrationCard concentration={intel.concentration} topClient={intel.topClient} />
        </div>
      </div>
      <Rankings rankings={intel.rankings} />
    </div>
  );
}

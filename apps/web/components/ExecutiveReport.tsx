'use client';

import { Decimal } from 'decimal.js';
import type { DashboardKpis, PortfolioIntelligence } from '@pacific/shared';
import { formatBRL } from '@/lib/format';

const HEALTH = {
  HEALTHY: { label: 'Saudável', color: '#16a34a' },
  ATTENTION: { label: 'Atenção', color: '#d97706' },
  CRITICAL: { label: 'Crítica', color: '#dc2626' },
} as const;

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="border border-slate-200 rounded-lg p-3">
      <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{label}</p>
      <p className="text-lg font-semibold tabular-nums" style={{ color: accent ?? '#0f172a' }}>{value}</p>
    </div>
  );
}

/**
 * Relatório executivo em layout CLARO (próprio p/ imprimir/PDF/PNG). Self-contained: não usa os
 * tokens do tema escuro, para o documento sair limpo. Compartilhamento é local (o credor baixa).
 */
export function ExecutiveReport({ intel, kpis }: { intel: PortfolioIntelligence; kpis?: DashboardKpis }) {
  const h = HEALTH[intel.health.state];
  const profit = kpis ? new Decimal(kpis.totalExpectedReturn).minus(kpis.totalLent).toFixed(2) : null;
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div id="executive-report" className="bg-white text-slate-900 mx-auto max-w-3xl p-8 rounded-xl" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      {/* Cabeçalho */}
      <div className="flex items-baseline justify-between border-b border-slate-200 pb-4 mb-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Pacific · Resumo Executivo</p>
          <h1 className="text-2xl font-bold tracking-tight">Saúde da Carteira</h1>
        </div>
        <p className="text-xs text-slate-500">{today}</p>
      </div>

      {/* Saúde + resumo */}
      <div className="flex items-center gap-4 mb-5">
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold tabular-nums shrink-0" style={{ color: h.color, border: `2px solid ${h.color}` }}>
          {intel.health.score}
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: h.color }}>{h.label}</p>
          <p className="text-sm text-slate-600 leading-snug">{intel.summary}</p>
        </div>
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          <Stat label="Total investido" value={formatBRL(kpis.totalLent)} />
          <Stat label="A receber" value={formatBRL(kpis.totalReceivable)} />
          <Stat label="Retorno esperado" value={formatBRL(kpis.totalExpectedReturn)} />
          {profit && <Stat label="Lucro projetado" value={formatBRL(profit)} accent="#16a34a" />}
          <Stat label="Vencido" value={formatBRL(kpis.totalOverdue)} accent={Number(kpis.totalOverdue) > 0 ? '#dc2626' : undefined} />
          <Stat label="Operações ativas" value={String(kpis.countActive)} />
        </div>
      )}

      {/* Concentração */}
      <div className="mb-5">
        <h2 className="text-xs uppercase tracking-widest text-slate-500 mb-2">Concentração</h2>
        <p className="text-sm text-slate-700">
          3 maiores clientes: <b>{intel.concentration.top3Pct}%</b> · 5 maiores: <b>{intel.concentration.top5Pct}%</b> · 10 maiores: <b>{intel.concentration.top10Pct}%</b>
        </p>
        {intel.topClient && (
          <p className="text-sm text-slate-600 mt-1">
            Cliente mais importante: <b>{intel.topClient.name}</b> — {formatBRL(intel.topClient.exposure)} ({intel.topClient.sharePct}%).
          </p>
        )}
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <h2 className="text-xs uppercase tracking-widest text-slate-500 mb-2">Mais lucrativas</h2>
          <ul className="text-sm space-y-1">
            {intel.rankings.mostProfitable.slice(0, 5).map((o) => (
              <li key={o.id} className="flex justify-between"><span className="text-slate-700">{o.client}</span><span className="tabular-nums text-emerald-700">{formatBRL(o.expectedProfit)}</span></li>
            ))}
            {intel.rankings.mostProfitable.length === 0 && <li className="text-slate-400">—</li>}
          </ul>
        </div>
        <div>
          <h2 className="text-xs uppercase tracking-widest text-slate-500 mb-2">Maiores exposições (clientes)</h2>
          <ul className="text-sm space-y-1">
            {intel.rankings.clientsByExposure.slice(0, 5).map((c) => (
              <li key={c.name} className="flex justify-between"><span className="text-slate-700">{c.name}</span><span className="tabular-nums">{formatBRL(c.exposure)} · {c.sharePct}%</span></li>
            ))}
            {intel.rankings.clientsByExposure.length === 0 && <li className="text-slate-400">—</li>}
          </ul>
        </div>
      </div>

      <p className="text-[10px] text-slate-400 mt-6 pt-4 border-t border-slate-200">
        Gerado pela plataforma Pacific · {today}. Documento de apoio à decisão.
      </p>
    </div>
  );
}

'use client';

import type { PortfolioRow } from '@pacific/shared';
import { STATUS_COLOR, STATUS_LABEL } from '@/lib/status';
import { formatBRL, venceEm } from '@/lib/format';

function ScoreCell({ value, tone }: { value: number; tone: 'good' | 'urgency' }) {
  const color =
    tone === 'good'
      ? 'bg-status-green'
      : value >= 66
        ? 'bg-status-red'
        : value >= 33
          ? 'bg-status-orange'
          : 'bg-status-yellow';
  return (
    <td className="px-6 py-3">
      <div className="flex items-center gap-2 justify-end">
        <span className="font-mono text-xs text-text tabular-nums w-6 text-right">{value}</span>
        <span className="h-1 w-12 rounded-full bg-line overflow-hidden" aria-hidden>
          <span className={`block h-full ${color}`} style={{ width: `${value}%` }} />
        </span>
      </div>
    </td>
  );
}

export function CarteiraTable({ rows }: { rows: PortfolioRow[] }) {
  if (rows.length === 0) {
    return (
      <section className="bg-surface border border-line rounded-xl p-10 text-center">
        <p className="font-mono text-sm text-muted">Nenhuma dívida na carteira ainda.</p>
      </section>
    );
  }

  return (
    <section className="bg-surface border border-line rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-line flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold text-text tracking-tight">Carteira</h2>
        <span className="font-mono text-[10px] text-muted uppercase tracking-widest">{rows.length} dívidas</span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="font-mono text-[10px] text-muted uppercase tracking-widest">
            <th className="text-left font-normal px-6 py-2">Devedor</th>
            <th className="text-right font-normal px-6 py-2">Saldo</th>
            <th className="text-right font-normal px-6 py-2">Vence</th>
            <th className="text-right font-normal px-6 py-2" title="Recuperabilidade (0–100)">Recup.</th>
            <th className="text-right font-normal px-6 py-2" title="Temperatura / urgência (0–100)">Temp.</th>
            <th className="text-left font-normal px-6 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-line hover:bg-line/30 transition-colors">
              <td className="px-6 py-3 font-sans text-sm text-text">{r.debtorName}</td>
              <td className="px-6 py-3 font-mono text-sm text-text text-right tabular-nums">{formatBRL(r.balance)}</td>
              <td className="px-6 py-3 font-mono text-sm text-muted text-right tabular-nums">{venceEm(r.daysRemaining)}</td>
              <ScoreCell value={r.recoverability} tone="good" />
              <ScoreCell value={r.temperature} tone="urgency" />
              <td className="px-6 py-3">
                <span className="inline-flex items-center gap-2 font-mono text-xs text-muted">
                  <span className={`w-2 h-2 rounded-full ${STATUS_COLOR[r.status]}`} />
                  {STATUS_LABEL[r.status]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

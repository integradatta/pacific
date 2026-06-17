'use client';

import type { PortfolioRow } from '@pacific/shared';
import { STATUS_COLOR, STATUS_LABEL } from '@/lib/status';
import { formatBRL, venceEm } from '@/lib/format';

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
            <th className="text-left font-normal px-6 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-line hover:bg-line/30 transition-colors">
              <td className="px-6 py-3 font-sans text-sm text-text">{r.debtorName}</td>
              <td className="px-6 py-3 font-mono text-sm text-text text-right tabular-nums">{formatBRL(r.balance)}</td>
              <td className="px-6 py-3 font-mono text-sm text-muted text-right tabular-nums">{venceEm(r.daysRemaining)}</td>
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

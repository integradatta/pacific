'use client';

import Link from 'next/link';
import { Decimal } from 'decimal.js';
import type { PortfolioRow } from '@pacific/shared';
import { STATUS_COLOR, STATUS_LABEL } from '@/lib/status';
import { formatBRL, venceEm } from '@/lib/format';
import { RiskBadge } from './RiskBadge';
import { TagList } from './Tags';

const projectedProfit = (r: PortfolioRow): string => Decimal.max(0, new Decimal(r.expectedReturn).minus(r.principal)).toFixed(2);

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
    <td className="px-6 py-3.5">
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
      <section className="panel p-12 text-center">
        <p className="font-mono text-2xl text-muted/60 mb-3" aria-hidden>◈</p>
        <p className="font-sans text-sm text-text-dim">Nenhuma ajuda na carteira ainda.</p>
        <p className="font-mono text-[10px] text-muted uppercase tracking-widest mt-1 mb-5">cadastre uma ajuda para começar a monitorar</p>
        <Link
          href="/operacoes/nova"
          className="inline-flex items-center gap-2 bg-sonar text-ink font-mono text-xs font-semibold uppercase tracking-widest px-4 py-2.5 rounded-lg shadow-[0_8px_24px_-10px_rgb(var(--sonar)/0.7)] hover:brightness-110 active:translate-y-px transition-all"
        >
          <span aria-hidden>✦</span> Nova operação
        </Link>
      </section>
    );
  }

  return (
    <section className="panel overflow-hidden">
      <div className="px-6 py-4 border-b border-line flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold text-text tracking-tight">Carteira</h2>
        <span className="font-mono text-[10px] text-muted uppercase tracking-widest tabular-nums">{rows.length} ajudas</span>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full min-w-[760px]">
        <thead>
          <tr className="font-mono text-[10px] text-muted uppercase tracking-widest border-b border-line">
            <th className="text-left font-normal px-6 py-2.5">Sobrinho</th>
            <th className="text-right font-normal px-6 py-2.5" title="Valor devido agora (saldo com gratidão − pago)">Devido</th>
            <th className="text-right font-normal px-6 py-2.5" title="Lucro esperado no vencimento (= gratidão projetada)">Lucro esp.</th>
            <th className="text-right font-normal px-6 py-2.5">Vence</th>
            <th className="text-right font-normal px-6 py-2.5" title="Recuperabilidade (0–100)">Recup.</th>
            <th className="text-right font-normal px-6 py-2.5" title="Temperatura / urgência (0–100)">Temp.</th>
            <th className="text-left font-normal px-6 py-2.5">Risco</th>
            <th className="text-left font-normal px-6 py-2.5">Situação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-line/70 hover:bg-sonar/[0.03] transition-colors">
              <td className="px-6 py-3.5">
                <Link href={`/operacoes/${r.id}`} className="font-sans text-sm text-text hover:text-sonar transition-colors">
                  {r.debtorName}
                </Link>
                {r.tags.length > 0 && <div className="mt-1"><TagList tags={r.tags} /></div>}
              </td>
              <td className={`px-6 py-3.5 font-mono text-sm text-right tabular-nums ${r.settled ? 'text-muted' : 'text-text'}`}>
                {formatBRL(r.amountDue)}
              </td>
              <td className="px-6 py-3.5 font-mono text-sm text-status-green/90 text-right tabular-nums">{formatBRL(projectedProfit(r))}</td>
              <td className="px-6 py-3.5 font-mono text-sm text-muted text-right tabular-nums">{r.settled ? '—' : venceEm(r.daysRemaining)}</td>
              <ScoreCell value={r.recoverability} tone="good" />
              <ScoreCell value={r.temperature} tone="urgency" />
              <td className="px-6 py-3.5" title={r.riskReason}><RiskBadge recoverability={r.recoverability} compact /></td>
              <td className="px-6 py-3.5">
                {r.settled ? (
                  <span className="inline-flex items-center gap-2 font-mono text-xs text-status-green">
                    <span className="w-2 h-2 rounded-full bg-status-green" />
                    pago
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 font-mono text-xs text-muted">
                    <span className={`w-2 h-2 rounded-full ${STATUS_COLOR[r.status]}`} />
                    {STATUS_LABEL[r.status]}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </section>
  );
}

'use client';

import type { DashboardKpis } from '@pacific/shared';
import { formatBRL } from '@/lib/format';
import { STATUS_COLOR, STATUS_ORDER } from '@/lib/status';

function Readout({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-surface border border-line rounded-xl p-5">
      <p className="font-mono text-[10px] text-muted uppercase tracking-widest mb-2">{label}</p>
      <p className={`font-mono text-2xl font-medium tabular-nums ${accent ? 'text-status-red' : 'text-text'}`}>{value}</p>
    </div>
  );
}

export function KpiReadouts({ kpis }: { kpis: DashboardKpis }) {
  const total = STATUS_ORDER.reduce((sum, k) => sum + kpis.countByStatus[k], 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Readout label="Total emprestado" value={formatBRL(kpis.totalLent)} />
      <Readout label="A receber" value={formatBRL(kpis.totalReceivable)} />
      <Readout label="Vencido" value={formatBRL(kpis.totalOverdue)} accent={Number(kpis.totalOverdue) > 0} />

      <div className="bg-surface border border-line rounded-xl p-5">
        <p className="font-mono text-[10px] text-muted uppercase tracking-widest mb-2">Status da carteira</p>
        <div className="flex h-2.5 rounded-full overflow-hidden bg-line">
          {total === 0 ? (
            <div className="flex-1" />
          ) : (
            STATUS_ORDER.map((k) =>
              kpis.countByStatus[k] > 0 ? (
                <div
                  key={k}
                  className={STATUS_COLOR[k]}
                  style={{ width: `${(kpis.countByStatus[k] / total) * 100}%` }}
                  title={`${k}: ${kpis.countByStatus[k]}`}
                />
              ) : null,
            )
          )}
        </div>
        <div className="flex gap-3 mt-2 flex-wrap">
          {STATUS_ORDER.map((k) => (
            <span key={k} className="font-mono text-[10px] text-muted tabular-nums">
              <span className={`inline-block w-2 h-2 rounded-full mr-1 align-middle ${STATUS_COLOR[k]}`} />
              {kpis.countByStatus[k]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

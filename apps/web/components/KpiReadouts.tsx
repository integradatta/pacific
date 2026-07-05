'use client';

import type { DashboardKpis, RiskLevel } from '@pacific/shared';
import { formatBRL } from '@/lib/format';
import { STATUS_COLOR, STATUS_ORDER } from '@/lib/status';
import { RISK_META } from './RiskBadge';

const RISK_ORDER: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH'];

function Readout({ label, value, accent, sub }: { label: string; value: string; accent?: boolean; sub?: string }) {
  return (
    <div className="panel panel-hover p-5 sm:p-6">
      <p className="font-mono text-[10px] text-muted uppercase tracking-[0.2em] mb-2.5">{label}</p>
      <p className={`font-mono text-3xl leading-none font-medium tabular-nums tracking-tight ${accent ? 'text-status-red' : 'text-text'}`}>{value}</p>
      {sub ? <p className="font-sans text-[11px] text-text-dim mt-2 leading-snug">{sub}</p> : null}
    </div>
  );
}

function DistBar({ segments, total }: { segments: { key: string; n: number; cls: string }[]; total: number }) {
  return (
    <div className="flex h-2.5 rounded-full overflow-hidden bg-line">
      {total === 0 ? (
        <div className="flex-1" />
      ) : (
        segments.map((s) =>
          s.n > 0 ? <div key={s.key} className={s.cls} style={{ width: `${(s.n / total) * 100}%` }} title={`${s.key}: ${s.n}`} /> : null,
        )
      )}
    </div>
  );
}

export function KpiReadouts({ kpis, receivableSub, compact }: { kpis: DashboardKpis; receivableSub?: string; compact?: boolean }) {
  const total = STATUS_ORDER.reduce((sum, k) => sum + kpis.countByStatus[k], 0);
  const totalRisk = RISK_ORDER.reduce((sum, k) => sum + kpis.riskDistribution[k], 0);

  return (
    <div className="space-y-4">
      {/* Valores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Readout label="Total em ajudas" value={formatBRL(kpis.totalLent)} />
        <Readout label="A receber" value={formatBRL(kpis.totalReceivable)} sub={receivableSub} />
        <Readout label="Retorno esperado" value={formatBRL(kpis.totalExpectedReturn)} />
        <Readout label="Vencido" value={formatBRL(kpis.totalOverdue)} accent={Number(kpis.totalOverdue) > 0} />
      </div>

      {/* Pagamentos recebidos — só quando há atividade de quitação */}
      {(kpis.countSettled > 0 || Number(kpis.totalReceived) > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Readout label="Recebido" value={formatBRL(kpis.totalReceived)} />
          <Readout label="Quitadas" value={String(kpis.countSettled)} />
        </div>
      )}

      {/* Contagens + distribuições — ocultas na Torre de Controle (compact); vivem na Carteira/Evolução */}
      {!compact && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Readout label="Operações ativas" value={String(kpis.countActive)} />
        <Readout label="Operações vencidas" value={String(kpis.countByStatus.RED)} accent={kpis.countByStatus.RED > 0} />

        {/* Status da carteira */}
        <div className="panel p-5">
          <p className="font-mono text-[10px] text-muted uppercase tracking-widest mb-2">Status da carteira</p>
          <DistBar total={total} segments={STATUS_ORDER.map((k) => ({ key: k, n: kpis.countByStatus[k], cls: STATUS_COLOR[k] }))} />
          <div className="flex gap-3 mt-2 flex-wrap">
            {STATUS_ORDER.map((k) => (
              <span key={k} className="font-mono text-[10px] text-muted tabular-nums">
                <span className={`inline-block w-2 h-2 rounded-full mr-1 align-middle ${STATUS_COLOR[k]}`} />
                {kpis.countByStatus[k]}
              </span>
            ))}
          </div>
        </div>

        {/* Distribuição por risco */}
        <div className="panel p-5">
          <p className="font-mono text-[10px] text-muted uppercase tracking-widest mb-2">Distribuição por risco</p>
          <DistBar total={totalRisk} segments={RISK_ORDER.map((k) => ({ key: k, n: kpis.riskDistribution[k], cls: RISK_META[k].dot }))} />
          <div className="flex gap-3 mt-2 flex-wrap">
            {RISK_ORDER.map((k) => (
              <span key={k} className="font-mono text-[10px] text-muted tabular-nums">
                <span className={`inline-block w-2 h-2 rounded-full mr-1 align-middle ${RISK_META[k].dot}`} />
                {RISK_META[k].short} {kpis.riskDistribution[k]}
              </span>
            ))}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

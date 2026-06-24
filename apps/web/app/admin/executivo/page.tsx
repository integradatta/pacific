'use client';

import { AdminShell } from '@/components/admin/AdminShell';
import { KpiCard } from '@/components/admin/ui';
import { useAdminOverview } from '@/lib/admin';
import { formatBRL } from '@/lib/format';

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="font-mono text-[11px] text-muted uppercase tracking-wider">{label}</span>
        <span className="font-mono text-sm text-text tabular-nums">{formatBRL(String(value))}</span>
      </div>
      <div className="h-2.5 rounded-full bg-line overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function ExecutivoPage() {
  const overview = useAdminOverview();
  const o = overview.data;
  const lent = o ? Number(o.volumeLent) : 0;
  const out = o ? Number(o.outstanding) : 0;
  const recv = o ? Number(o.received) : 0;
  const max = Math.max(1, lent, out, recv);

  return (
    <AdminShell title="Executivo">
      <div className="space-y-6 max-w-4xl">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Padrinhos" value={o ? String(o.creditorsTotal) : '—'} sub={o ? `${o.creditorsActive} ativos` : ''} tone="iris" />
          <KpiCard label="Operações" value={o ? String(o.operationsTotal) : '—'} sub={o ? `${o.operationsActive} ativas` : ''} />
          <KpiCard label="Volume na plataforma" value={o ? formatBRL(o.volumeLent) : '—'} />
          <KpiCard label="Novos hoje" value={o ? String(o.newCreditorsToday) : '—'} tone="sonar" />
        </div>

        <section className="panel p-6 space-y-5">
          <h2 className="font-display text-lg font-semibold text-text tracking-tight">Saúde financeira da plataforma</h2>
          <Bar label="Total em ajuda" value={lent} max={max} color="bg-iris" />
          <Bar label="A receber (em aberto)" value={out} max={max} color="bg-status-yellow" />
          <Bar label="Já recebido" value={recv} max={max} color="bg-status-green" />
          <p className="font-mono text-[10px] text-muted tracking-wider pt-2">
            {o ? `${o.operationsOverdue} operações vencidas em toda a plataforma` : ''}
          </p>
        </section>
      </div>
    </AdminShell>
  );
}

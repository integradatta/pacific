'use client';

import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { useReports, useGenerateReport, type MonthlyReportRow } from '@/lib/reports';
import { formatBRL } from '@/lib/format';
import { ListSkeleton } from '@/components/Skeleton';
import { ErrorState, EmptyState } from '@/components/States';
import { toast } from '@/components/Toast';

const HEALTH: Record<string, { label: string; cls: string }> = {
  HEALTHY: { label: 'Saudável', cls: 'text-status-green border-status-green/40 bg-status-green/10' },
  ATTENTION: { label: 'Atenção', cls: 'text-status-yellow border-status-yellow/40 bg-status-yellow/10' },
  CRITICAL: { label: 'Crítica', cls: 'text-status-red border-status-red/40 bg-status-red/10' },
};

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function ReportCard({ r }: { r: MonthlyReportRow }) {
  const h = HEALTH[r.healthState] ?? HEALTH.HEALTHY;
  const kpis = [
    { label: 'Total investido', value: formatBRL(r.totalLent) },
    { label: 'A receber', value: formatBRL(r.totalReceivable) },
    { label: 'Recebido', value: formatBRL(r.totalReceived) },
    { label: 'Vencido', value: formatBRL(r.totalOverdue) },
  ];
  return (
    <section className="panel p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-text tracking-tight capitalize">{monthLabel(r.month)}</h2>
          <p className="font-mono text-[10px] text-muted uppercase tracking-widest mt-0.5">gerado em {new Date(r.generatedAt).toLocaleDateString('pt-BR')}</p>
        </div>
        <span className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border ${h!.cls}`}>{h!.label} · {r.healthScore}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="min-w-0">
            <p className="font-mono text-[10px] text-muted uppercase tracking-widest mb-1">{k.label}</p>
            <p className="font-mono text-base text-text tabular-nums break-words">{k.value}</p>
          </div>
        ))}
      </div>
      <p className="font-mono text-[10px] text-muted tracking-wider mt-3">{r.opsActive} ativas · {r.opsSettled} quitadas</p>
    </section>
  );
}

export default function RelatoriosPage() {
  const reports = useReports();
  const generate = useGenerateReport();
  const rows = reports.data ?? [];

  function gerar() {
    generate.mutate(undefined, {
      onSuccess: () => toast('Relatório do mês atual gerado.', 'success'),
      onError: () => toast('Não foi possível gerar agora.', 'error'),
    });
  }

  return (
    <Shell title="Relatórios">
      <div className="max-w-3xl space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="font-sans text-sm text-text-dim">
            Um retrato dos seus números a cada mês, arquivado automaticamente. <Link href="/relatorio" className="text-sonar hover:underline">Exportar resumo executivo →</Link>
          </p>
          <button
            type="button" onClick={gerar} disabled={generate.isPending}
            className="font-mono text-[11px] uppercase tracking-widest bg-sonar text-ink font-semibold px-4 py-2 rounded-lg hover:brightness-110 active:translate-y-px disabled:opacity-50 transition-all shrink-0"
          >
            {generate.isPending ? 'Gerando…' : 'Gerar mês atual'}
          </button>
        </div>

        {reports.isLoading ? (
          <ListSkeleton rows={3} />
        ) : reports.isError ? (
          <ErrorState message="Não foi possível carregar os relatórios." />
        ) : rows.length === 0 ? (
          <EmptyState glyph="◆" title="Nenhum relatório ainda." hint="gere o do mês atual ou aguarde a virada do mês" action={{ label: 'Gerar mês atual', onClick: gerar, pending: generate.isPending }} />
        ) : (
          <div className="space-y-4">
            {rows.map((r) => <ReportCard key={r.month} r={r} />)}
          </div>
        )}
      </div>
    </Shell>
  );
}

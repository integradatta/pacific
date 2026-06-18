'use client';

import { Shell } from '@/components/Shell';
import { useKpis, usePortfolio } from '@/lib/hooks';
import { HorizonteVencimentos } from '@/components/HorizonteVencimentos';
import { KpiReadouts } from '@/components/KpiReadouts';
import { CarteiraTable } from '@/components/CarteiraTable';

export default function DashboardPage() {
  const kpis = useKpis();
  const portfolio = usePortfolio();
  const loading = kpis.isLoading || portfolio.isLoading;
  const error = kpis.isError || portfolio.isError;

  return (
    <Shell title="Torre de Controle">
      {loading ? (
        <div className="bg-surface border border-line rounded-xl p-10 flex items-center justify-center min-h-48">
          <p className="font-mono text-sm text-muted tracking-wider animate-pulse">Conectando à carteira…</p>
        </div>
      ) : error ? (
        <div className="bg-surface border border-status-red/40 rounded-xl p-8" role="alert">
          <p className="font-mono text-sm text-status-red">
            Não foi possível carregar a carteira. Verifique a conexão e tente novamente.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <HorizonteVencimentos rows={portfolio.data ?? []} />
          {kpis.data ? <KpiReadouts kpis={kpis.data} /> : null}
          <CarteiraTable rows={portfolio.data ?? []} />
        </div>
      )}
    </Shell>
  );
}

'use client';

import { Shell } from '@/components/Shell';
import { useKpis, usePortfolio } from '@/lib/hooks';
import { HorizonteVencimentos } from '@/components/HorizonteVencimentos';
import { KpiReadouts } from '@/components/KpiReadouts';
import { CarteiraTable } from '@/components/CarteiraTable';
import { DashboardSkeleton } from '@/components/Skeleton';

export default function DashboardPage() {
  const kpis = useKpis();
  const portfolio = usePortfolio();
  const loading = kpis.isLoading || portfolio.isLoading;
  const error = kpis.isError || portfolio.isError;

  return (
    <Shell title="Torre de Controle">
      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <div className="panel p-8 border-status-red/40" role="alert">
          <p className="font-mono text-[10px] text-status-red uppercase tracking-widest mb-1.5">sinal perdido</p>
          <p className="font-sans text-sm text-text-dim">
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

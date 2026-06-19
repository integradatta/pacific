'use client';

import { Shell } from '@/components/Shell';
import { usePortfolio } from '@/lib/hooks';
import { CarteiraTable } from '@/components/CarteiraTable';

export default function CarteiraPage() {
  const portfolio = usePortfolio();
  return (
    <Shell title="Carteira">
      {portfolio.isLoading ? (
        <div className="bg-surface border border-line rounded-xl p-10 text-center">
          <p className="font-mono text-sm text-muted animate-pulse">Carregando…</p>
        </div>
      ) : portfolio.isError ? (
        <div className="bg-surface border border-status-red/40 rounded-xl p-8" role="alert">
          <p className="font-mono text-sm text-status-red">Não foi possível carregar a carteira.</p>
        </div>
      ) : (
        <CarteiraTable rows={portfolio.data ?? []} />
      )}
    </Shell>
  );
}

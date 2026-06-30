'use client';

import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { useKpis, usePortfolio, useIntelligence, useThresholds } from '@/lib/hooks';
import { HorizonteVencimentos } from '@/components/HorizonteVencimentos';
import { KpiReadouts } from '@/components/KpiReadouts';
import { CarteiraTable } from '@/components/CarteiraTable';
import { IntelligenceBlock } from '@/components/Intelligence';
import { PendingClaims } from '@/components/PendingClaims';
import { DashboardSkeleton } from '@/components/Skeleton';

export default function DashboardPage() {
  const [thresholds] = useThresholds();
  const kpis = useKpis();
  const portfolio = usePortfolio();
  const intelligence = useIntelligence(thresholds);
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
          {/* Pagamentos informados pelos sobrinhos aguardando confirmação (some quando vazio) */}
          <PendingClaims />
          {intelligence.data ? (
            <>
              <div className="flex justify-end gap-2">
                <Link href="/configuracoes" className="font-mono text-[11px] text-muted hover:text-sonar uppercase tracking-widest border border-line hover:border-sonar/40 rounded-lg px-3 py-1.5 transition-colors">
                  Ajustes
                </Link>
                <Link href="/relatorio" className="font-mono text-[11px] text-muted hover:text-sonar uppercase tracking-widest border border-line hover:border-sonar/40 rounded-lg px-3 py-1.5 transition-colors">
                  Exportar resumo →
                </Link>
              </div>
              <IntelligenceBlock intel={intelligence.data} />
            </>
          ) : null}
          <HorizonteVencimentos rows={portfolio.data ?? []} />
          {kpis.data ? <KpiReadouts kpis={kpis.data} /> : null}
          <CarteiraTable rows={portfolio.data ?? []} />
        </div>
      )}
    </Shell>
  );
}

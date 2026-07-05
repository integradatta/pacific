'use client';

import Link from 'next/link';
import { receivableRisk } from '@pacific/shared';
import { Shell } from '@/components/Shell';
import { TodaySuggestions } from '@/components/TodaySuggestions';
import { useHome, useThresholds } from '@/lib/hooks';
import { HorizonteVencimentos } from '@/components/HorizonteVencimentos';
import { KpiReadouts } from '@/components/KpiReadouts';
import { HealthHero, PortfolioHighlights } from '@/components/Intelligence';
import { PendingClaims } from '@/components/PendingClaims';
import { LocationDeclines } from '@/components/LocationDeclines';
import { DashboardSkeleton } from '@/components/Skeleton';

export default function DashboardPage() {
  const [thresholds] = useThresholds();
  const home = useHome(thresholds);
  const data = home.data;
  const loading = home.isLoading;
  const error = home.isError;

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
          {/* Acionável primeiro: o que fazer hoje + o que aguarda você (somem quando vazios) */}
          <TodaySuggestions />
          {data && data.pendingClaims.length > 0 ? <PendingClaims rows={data.pendingClaims} /> : null}
          <LocationDeclines />

          {data ? (
            <>
              {/* Headline: saúde da carteira + resumo automático */}
              <HealthHero health={data.intelligence.health} summary={data.intelligence.summary} />

              {/* Foco principal: os números-chave */}
              {(() => {
                const risk = receivableRisk(data.portfolio);
                const sub = Number(risk.nominal) > 0 ? `~${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(risk.probable))} prováveis (${risk.confidencePct}%)` : undefined;
                return <KpiReadouts kpis={data.kpis} receivableSub={sub} compact />;
              })()}

              {/* Foco principal: radar de vencimentos */}
              <HorizonteVencimentos rows={data.portfolio} />

              {/* Destaques (lucrativas/arriscadas/exposição) — recolhido por padrão */}
              <PortfolioHighlights rankings={data.intelligence.rankings} />

              <div className="flex justify-end gap-2 pt-1">
                <Link href="/relatorio" className="font-mono text-[11px] text-muted hover:text-sonar uppercase tracking-widest border border-line hover:border-sonar/40 rounded-lg px-3 py-1.5 transition-colors">
                  Exportar resumo →
                </Link>
              </div>
            </>
          ) : null}
        </div>
      )}
    </Shell>
  );
}

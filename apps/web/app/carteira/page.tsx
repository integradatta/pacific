'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { usePortfolio } from '@/lib/hooks';
import { CarteiraTable } from '@/components/CarteiraTable';
import { ListSkeleton } from '@/components/Skeleton';
import { ErrorState } from '@/components/States';
import { riskLevel, type DebtStatus, type RiskLevel } from '@pacific/shared';

const STATUS_OPTS: { v: DebtStatus | 'ALL'; label: string }[] = [
  { v: 'ALL', label: 'Status: todos' },
  { v: 'GREEN', label: 'Em dia' },
  { v: 'YELLOW', label: 'Vence ≤30d' },
  { v: 'ORANGE', label: 'Vence ≤7d' },
  { v: 'RED', label: 'Vencido' },
];
const RISK_OPTS: { v: RiskLevel | 'ALL'; label: string }[] = [
  { v: 'ALL', label: 'Risco: todos' },
  { v: 'LOW', label: 'Baixo risco' },
  { v: 'MEDIUM', label: 'Médio risco' },
  { v: 'HIGH', label: 'Alto risco' },
];

const controlClass =
  'bg-surface2 border border-line rounded-lg px-3 py-2 text-text font-mono text-xs focus:outline-none focus:border-sonar focus:shadow-glow transition-all';

function CarteiraInner() {
  const portfolio = usePortfolio();
  const params = useSearchParams();
  // Filtros iniciais vindos da URL (insights/rankings clicáveis fazem deep-link).
  const initStatus = (params.get('status') as DebtStatus | null) ?? 'ALL';
  const initRisk = (params.get('risk') as RiskLevel | null) ?? 'ALL';
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [status, setStatus] = useState<DebtStatus | 'ALL'>(initStatus);
  const [risk, setRisk] = useState<RiskLevel | 'ALL'>(initRisk);
  const [tag, setTag] = useState<string>('ALL');

  // Etiquetas disponíveis: união ordenada das tags presentes na carteira.
  const tagOptions = useMemo(
    () => Array.from(new Set((portfolio.data ?? []).flatMap((r) => r.tags))).sort(),
    [portfolio.data],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (portfolio.data ?? []).filter(
      (r) =>
        (q === '' || r.debtorName.toLowerCase().includes(q)) &&
        (status === 'ALL' || r.status === status) &&
        (risk === 'ALL' || riskLevel(r.recoverability) === risk) &&
        (tag === 'ALL' || r.tags.includes(tag)),
    );
  }, [portfolio.data, search, status, risk, tag]);

  return (
    <Shell title="Carteira">
      {portfolio.isLoading ? (
        <ListSkeleton />
      ) : portfolio.isError ? (
        <ErrorState message="Não foi possível carregar a carteira." />
      ) : (
        <div className="space-y-4">
          {/* Busca + filtros */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente…"
              aria-label="Buscar cliente"
              className={`${controlClass} flex-1 min-w-48 font-sans text-sm placeholder:text-muted`}
            />
            <select value={status} onChange={(e) => setStatus(e.target.value as DebtStatus | 'ALL')} aria-label="Filtrar por status" className={controlClass}>
              {STATUS_OPTS.map((o) => (
                <option key={o.v} value={o.v}>{o.label}</option>
              ))}
            </select>
            <select value={risk} onChange={(e) => setRisk(e.target.value as RiskLevel | 'ALL')} aria-label="Filtrar por risco" className={controlClass}>
              {RISK_OPTS.map((o) => (
                <option key={o.v} value={o.v}>{o.label}</option>
              ))}
            </select>
            {tagOptions.length > 0 && (
              <select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filtrar por etiqueta" className={controlClass}>
                <option value="ALL">Etiqueta: todas</option>
                {tagOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}
          </div>

          <CarteiraTable rows={rows} />
        </div>
      )}
    </Shell>
  );
}

export default function CarteiraPage() {
  return (
    <Suspense fallback={<Shell title="Carteira"><ListSkeleton /></Shell>}>
      <CarteiraInner />
    </Suspense>
  );
}

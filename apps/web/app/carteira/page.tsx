'use client';

import { useMemo, useState } from 'react';
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

export default function CarteiraPage() {
  const portfolio = usePortfolio();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<DebtStatus | 'ALL'>('ALL');
  const [risk, setRisk] = useState<RiskLevel | 'ALL'>('ALL');

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (portfolio.data ?? []).filter(
      (r) =>
        (q === '' || r.debtorName.toLowerCase().includes(q)) &&
        (status === 'ALL' || r.status === status) &&
        (risk === 'ALL' || riskLevel(r.recoverability) === risk),
    );
  }, [portfolio.data, search, status, risk]);

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
          </div>

          <CarteiraTable rows={rows} />
        </div>
      )}
    </Shell>
  );
}

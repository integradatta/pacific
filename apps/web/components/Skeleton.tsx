/** Bloco de carregamento com shimmer. `.skeleton` vem de globals.css. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`skeleton block ${className}`} aria-hidden />;
}

/** Estado de carregamento do dashboard: espelha o layout real (horizonte + KPIs + tabela). */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Carregando carteira">
      {/* Horizonte */}
      <section className="panel p-6">
        <div className="flex items-baseline justify-between mb-6">
          <Skeleton className="h-4 w-48 rounded" />
          <Skeleton className="h-3 w-20 rounded" />
        </div>
        <Skeleton className="h-28 w-full rounded-lg" />
      </section>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="panel p-5">
            <Skeleton className="h-2.5 w-24 rounded mb-3" />
            <Skeleton className="h-7 w-32 rounded" />
          </div>
        ))}
      </div>

      {/* Tabela */}
      <section className="panel overflow-hidden">
        <div className="px-6 py-4 border-b border-line">
          <Skeleton className="h-4 w-28 rounded" />
        </div>
        <div className="divide-y divide-line">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-6 py-3.5 flex items-center gap-4">
              <Skeleton className="h-3.5 w-40 rounded" />
              <Skeleton className="h-3.5 w-24 rounded ml-auto" />
              <Skeleton className="h-3.5 w-16 rounded" />
              <Skeleton className="h-1.5 w-12 rounded-full" />
            </div>
          ))}
        </div>
      </section>

      <span className="sr-only">Carregando…</span>
    </div>
  );
}

/** Skeleton genérico de lista/tabela em painel — para telas que carregam coleções. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <section className="panel overflow-hidden" role="status" aria-label="Carregando">
      <div className="px-6 py-4 border-b border-line">
        <Skeleton className="h-4 w-32 rounded" />
      </div>
      <div className="divide-y divide-line">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-6 py-3.5 flex items-center gap-4">
            <Skeleton className="h-3.5 w-44 rounded" />
            <Skeleton className="h-3.5 w-24 rounded ml-auto" />
            <Skeleton className="h-3.5 w-16 rounded" />
          </div>
        ))}
      </div>
      <span className="sr-only">Carregando…</span>
    </section>
  );
}

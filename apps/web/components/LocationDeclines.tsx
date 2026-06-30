'use client';

import Link from 'next/link';
import { useDeclines } from '@/lib/location';

// Banner no dashboard: avisa o padrinho quando um sobrinho RECUSA compartilhar a localização.
// Some quando não há recusas (não polui o dashboard).
export function LocationDeclines() {
  const declines = useDeclines();
  const rows = declines.data ?? [];
  if (rows.length === 0) return null;

  return (
    <section className="panel overflow-hidden border-status-yellow/40">
      <div className="px-6 py-4 border-b border-line flex items-baseline justify-between">
        <h2 className="font-display text-base font-semibold text-text tracking-tight flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-status-yellow" /> Recusaram compartilhar localização
        </h2>
        <Link href="/localizacao" className="font-mono text-[10px] text-iris uppercase tracking-widest hover:underline">ver no mapa</Link>
      </div>
      <ul className="divide-y divide-line/70">
        {rows.slice(0, 5).map((d) => (
          <li key={d.debtorId} className="px-6 py-3 flex items-center justify-between gap-3">
            <span className="font-sans text-sm text-text truncate">{d.debtorName}</span>
            <span className="font-mono text-[11px] text-muted tabular-nums shrink-0">{d.declinedAt ? new Date(d.declinedAt).toLocaleDateString('pt-BR') : '—'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

'use client';

import { useDebtorProfile } from '@/lib/insights';

// Perfil comportamental — COMPACTO (uma frase + poucos chips). Sem excesso; mobile-harmônico.
const RELIABILITY: Record<string, { label: string; cls: string }> = {
  reliable: { label: 'Pontual', cls: 'text-status-green border-status-green/40 bg-status-green/10' },
  usually_late: { label: 'Atrasa mas paga', cls: 'text-iris border-iris/40 bg-iris/10' },
  unpredictable: { label: 'Irregular', cls: 'text-status-red border-status-red/40 bg-status-red/10' },
  unknown: { label: 'Perfil em formação', cls: 'text-muted border-line bg-surface2' },
};

function Chip({ children, cls = 'text-muted border-line bg-surface2' }: { children: React.ReactNode; cls?: string }) {
  return <span className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider rounded px-2 py-1 border ${cls}`}>{children}</span>;
}

export function DebtorProfileCard({ debtorId, name }: { debtorId: string; name: string }) {
  const q = useDebtorProfile(debtorId);
  const p = q.data;

  return (
    <section className="panel p-5">
      <h3 className="font-mono text-xs text-muted uppercase tracking-widest mb-2">Como {name.split(' ')[0]} costuma agir</h3>
      {q.isLoading ? (
        <div className="skeleton h-5 w-3/4 rounded" />
      ) : !p ? (
        <p className="font-sans text-sm text-text-dim">Perfil indisponível.</p>
      ) : (
        <>
          <p className="font-sans text-sm text-text leading-relaxed">{p.summary}</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            <Chip cls={RELIABILITY[p.reliability]?.cls}>{RELIABILITY[p.reliability]?.label ?? p.reliability}</Chip>
            {p.bestTime && <Chip>🕘 lembrar {p.bestTime.label}</Chip>}
            {p.engagementTrend === 'down' && <Chip cls="text-iris border-iris/40 bg-iris/10">engajamento ↓</Chip>}
            {p.claimConfirmRate != null && p.claimConfirmRate >= 0.8 && <Chip cls="text-status-green border-status-green/40 bg-status-green/10">avisos confiáveis</Chip>}
          </div>
        </>
      )}
    </section>
  );
}

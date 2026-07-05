'use client';

import { contractGuidance, type DebtSummary, type GuidanceTone } from '@pacific/shared';
import { useDebtorProfile } from '@/lib/insights';

/*
 * P1 — "Próxima ação": leitura SUGESTIVA no nível do contrato. Sintetiza os sinais que já existem
 * (probabilidade de pagamento, DebtorScore, tendência, confiabilidade, atraso) numa orientação.
 * Tom: sugestão, nunca ordem — o padrinho decide, a plataforma só lê os sinais. Só em operação aberta.
 */
const TONE: Record<GuidanceTone, { label: string; dot: string; ring: string; soft: string; text: string }> = {
  calm: { label: 'Tranquilo', dot: 'bg-status-green', ring: 'border-status-green/30', soft: 'bg-status-green/[0.06]', text: 'text-status-green' },
  watch: { label: 'Acompanhar', dot: 'bg-status-yellow', ring: 'border-status-yellow/30', soft: 'bg-status-yellow/[0.06]', text: 'text-status-yellow' },
  act: { label: 'Vale atenção', dot: 'bg-status-red', ring: 'border-status-red/30', soft: 'bg-status-red/[0.06]', text: 'text-status-red' },
};

export function NextActionCard({ debtorId, summary }: { debtorId: string; summary: DebtSummary }) {
  const profile = useDebtorProfile(debtorId);
  if (summary.settled) return null;

  const g = contractGuidance({
    settled: summary.settled,
    daysRemaining: summary.daysRemaining,
    paymentProbability: summary.scores.paymentProbability,
    score: profile.data?.score ?? null,
    scoreTrend: profile.data?.scoreTrend ?? 'unknown',
    reliability: (profile.data?.reliability as never) ?? 'unknown',
  });
  const t = TONE[g.tone];

  return (
    <section className={`panel p-6 border ${t.ring} ${t.soft}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-mono text-xs text-muted uppercase tracking-widest">Próxima ação</h3>
        <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest ${t.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} /> {t.label}
        </span>
      </div>

      <p className="font-display text-lg text-text leading-snug tracking-tight">{g.headline}</p>

      {g.because.length > 0 && (
        <ul className="mt-3 space-y-1">
          {g.because.map((b, i) => (
            <li key={i} className="font-sans text-[13px] text-text-dim flex items-start gap-2">
              <span className="text-muted mt-[3px] text-[9px]" aria-hidden>◆</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="font-sans text-[11px] text-muted mt-4 pt-3 border-t border-line/60">
        Leitura dos sinais — a decisão é sua.
      </p>
    </section>
  );
}

'use client';

import { riskLevel, type RiskLevel } from '@pacific/shared';

const RISK_META: Record<RiskLevel, { label: string; short: string; cls: string; dot: string }> = {
  LOW: { label: 'Baixo risco', short: 'Baixo', cls: 'text-status-green border-status-green/40 bg-status-green/10', dot: 'bg-status-green' },
  MEDIUM: { label: 'Médio risco', short: 'Médio', cls: 'text-status-orange border-status-orange/40 bg-status-orange/10', dot: 'bg-status-orange' },
  HIGH: { label: 'Alto risco', short: 'Alto', cls: 'text-status-red border-status-red/40 bg-status-red/10', dot: 'bg-status-red' },
};

/** Badge de risco (Baixo/Médio/Alto) derivado da recuperabilidade (0–100). */
export function RiskBadge({ recoverability, compact = false }: { recoverability: number; compact?: boolean }) {
  const meta = RISK_META[riskLevel(recoverability)];
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${meta.cls}`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${meta.dot}`} aria-hidden />
      {compact ? meta.short : meta.label}
    </span>
  );
}

export { RISK_META };

import type { ReactNode } from 'react';

export function KpiCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'iris' | 'red' | 'sonar' }) {
  const valueColor = tone === 'red' ? 'text-status-red' : tone === 'iris' ? 'text-iris' : tone === 'sonar' ? 'text-sonar' : 'text-text';
  return (
    <div className="panel panel-hover p-4 sm:p-5 min-w-0">
      <p className="font-mono text-[10px] text-muted uppercase tracking-widest mb-2">{label}</p>
      <p className={`font-mono text-xl sm:text-2xl font-medium tabular-nums tracking-tight break-words ${valueColor}`}>{value}</p>
      {sub ? <p className="font-mono text-[10px] text-muted mt-1 tracking-wider break-words">{sub}</p> : null}
    </div>
  );
}

export function AdminBadge({ children, tone }: { children: ReactNode; tone: 'iris' | 'green' | 'yellow' | 'red' | 'muted' }) {
  const cls = {
    iris: 'text-iris border-iris/40 bg-iris/10',
    green: 'text-status-green border-status-green/40 bg-status-green/10',
    yellow: 'text-status-yellow border-status-yellow/40 bg-status-yellow/10',
    red: 'text-status-red border-status-red/40 bg-status-red/10',
    muted: 'text-muted border-line bg-surface2',
  }[tone];
  return <span className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${cls}`}>{children}</span>;
}

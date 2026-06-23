'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Shell } from '@/components/Shell';
import { ThresholdSettings } from '@/components/Intelligence';
import { useThresholds } from '@/lib/hooks';
import { apiGet } from '@/lib/api';

interface Me { email: string; role: string; tenantId: string | null; approved: boolean }

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-t border-line/70 first:border-t-0">
      <span className="font-sans text-sm text-text-dim">{label}</span>
      <span className="font-mono text-sm text-text tabular-nums truncate max-w-[60%]">{value}</span>
    </div>
  );
}

export default function ConfiguracoesPage() {
  const me = useQuery({ queryKey: ['auth-me'], queryFn: () => apiGet<Me>('/auth/me') });
  const [thresholds, setThresholds] = useThresholds();

  return (
    <Shell title="Configurações">
      <div className="space-y-6 max-w-2xl">
        {/* Conta */}
        <section className="panel p-6">
          <h2 className="font-display text-lg font-semibold text-text tracking-tight mb-3">Conta</h2>
          {me.isLoading ? (
            <p className="font-mono text-sm text-muted">Carregando…</p>
          ) : (
            <div>
              <Row label="E-mail" value={me.data?.email ?? '—'} />
              <Row label="Perfil" value={me.data?.role === 'SUPER_ADMIN' ? 'Administrador' : 'Padrinho'} />
              <Row label="Situação" value={me.data?.approved ? 'Aprovada' : 'Aguardando aprovação'} />
              <Row label="Carteira" value={me.data?.tenantId ? `${me.data.tenantId.slice(0, 8)}…` : '—'} />
            </div>
          )}
        </section>

        {/* Inteligência */}
        <section className="space-y-2">
          <h2 className="font-display text-lg font-semibold text-text tracking-tight">Inteligência da carteira</h2>
          <p className="font-sans text-sm text-text-dim">Defina o que conta como alto risco e concentração excessiva. Aplica-se ao dashboard e ao resumo.</p>
          <ThresholdSettings thresholds={thresholds} onChange={setThresholds} />
        </section>

        {/* Alertas */}
        <section className="panel p-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-text tracking-tight">Alertas de vencimento</h2>
            <p className="font-sans text-sm text-text-dim">Escolha as réguas (15/7/3/1 dia, no vencimento, após vencer).</p>
          </div>
          <Link href="/notificacoes" className="font-mono text-[11px] text-sonar uppercase tracking-widest border border-sonar/40 rounded-lg px-3 py-2 hover:bg-sonar/10 transition-colors shrink-0">Gerenciar →</Link>
        </section>
      </div>
    </Shell>
  );
}

'use client';

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shell } from '@/components/Shell';
import { ThresholdSettings } from '@/components/Intelligence';
import { useThresholds } from '@/lib/hooks';
import { apiGet, apiPost } from '@/lib/api';

interface Me { email: string; role: string; tenantId: string | null; approved: boolean; weeklyDigestOptIn?: boolean | null }

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-t border-line/70 first:border-t-0">
      <span className="font-sans text-sm text-text-dim">{label}</span>
      <span className="font-mono text-sm text-text tabular-nums truncate max-w-[60%]">{value}</span>
    </div>
  );
}

export default function ConfiguracoesPage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ['auth-me'], queryFn: () => apiGet<Me>('/auth/me') });
  const setDigest = useMutation({
    mutationFn: (weeklyDigest: boolean) => apiPost('/auth/notification-prefs', { weeklyDigest }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['auth-me'] }),
  });
  const sendNow = useMutation({
    mutationFn: () => apiPost<{ created: number }>('/notifications/weekly-digest'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const digestOn = me.data?.weeklyDigestOptIn === true;
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

        {/* Resumo semanal */}
        <section className="panel p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-text tracking-tight">Resumo semanal</h2>
              <p className="font-sans text-sm text-text-dim">Um panorama da carteira nas suas notificações, uma vez por semana{me.data?.weeklyDigestOptIn === null ? ' — você ainda não decidiu.' : '.'}</p>
            </div>
            <button
              type="button" role="switch" aria-checked={digestOn} aria-label="Resumo semanal"
              onClick={() => setDigest.mutate(!digestOn)} disabled={setDigest.isPending}
              className="relative w-12 h-7 rounded-full transition-colors shrink-0 disabled:opacity-50"
              style={{ background: digestOn ? 'rgb(var(--sonar))' : 'rgb(var(--line-strong))' }}
            >
              <span className="absolute top-1 w-5 h-5 rounded-full bg-white transition-all" style={{ left: digestOn ? '26px' : '4px' }} />
            </button>
          </div>
          {digestOn && (
            <div className="mt-4 pt-4 border-t border-line/70 flex items-center gap-3">
              <button type="button" onClick={() => sendNow.mutate()} disabled={sendNow.isPending}
                className="font-mono text-[11px] text-sonar uppercase tracking-widest border border-sonar/40 rounded-lg px-3 py-2 hover:bg-sonar/10 transition-colors disabled:opacity-50">
                {sendNow.isPending ? 'Gerando…' : 'Gerar agora (teste)'}
              </button>
              {sendNow.isSuccess && <span className="font-sans text-xs text-status-green">Resumo gerado — veja em Notificações.</span>}
            </div>
          )}
        </section>

        {/* Lixeira */}
        <section className="panel p-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-text tracking-tight">Lixeira</h2>
            <p className="font-sans text-sm text-text-dim">Operações excluídas, restauráveis por 30 dias.</p>
          </div>
          <Link href="/lixeira" className="font-mono text-[11px] text-muted uppercase tracking-widest border border-line rounded-lg px-3 py-2 hover:border-sonar/40 hover:text-sonar transition-colors shrink-0">Abrir →</Link>
        </section>
      </div>
    </Shell>
  );
}

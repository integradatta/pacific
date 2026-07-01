'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api';
import { fetchMe, type Me } from '@/lib/auth-redirect';

/*
 * Convite de 1º acesso do padrinho: aceitar ou negar o resumo SEMANAL (push). Aparece só quando
 * a preferência ainda não foi decidida (weeklyDigestOptIn === null). Depois de decidir, some — e
 * pode ser alterado em Configurações. Montado no Shell (todas as telas do credor).
 */
export function WeeklyDigestGate() {
  const qc = useQueryClient();
  const me = useQuery<Me>({ queryKey: ['auth-me'], queryFn: () => fetchMe(), retry: false });
  const set = useMutation({
    mutationFn: (weeklyDigest: boolean) => apiPost('/auth/notification-prefs', { weeklyDigest }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['auth-me'] }),
  });

  const d = me.data;
  const undecided = d?.role === 'CREDITOR' && d.termsAccepted && d.weeklyDigestOptIn === null;
  if (!undecided) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(7,10,17,0.72)', backdropFilter: 'blur(4px)' }} role="dialog" aria-modal="true" aria-labelledby="wd-title">
      <div className="panel p-7 max-w-[420px] w-full animate-rise">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgb(var(--sonar) / 0.12)' }} aria-hidden>
          <span className="text-[22px]">🗓️</span>
        </div>
        <h2 id="wd-title" className="font-display text-xl font-semibold text-text tracking-tight">Resumo semanal</h2>
        <p className="font-sans text-sm text-text-dim mt-2 leading-relaxed">
          Quer receber, uma vez por semana, um resumo da sua carteira — quem venceu, quem está perto e como vão as ajudas? Você pode mudar isso quando quiser em Configurações.
        </p>
        {set.isError && <p role="alert" className="font-sans text-xs text-status-red mt-3">Não foi possível salvar. Tente novamente.</p>}
        <div className="flex flex-col gap-2 mt-6">
          <button type="button" onClick={() => set.mutate(true)} disabled={set.isPending}
            className="w-full bg-sonar text-ink font-mono text-xs font-semibold uppercase tracking-widest py-3 rounded-lg hover:brightness-110 active:translate-y-px disabled:opacity-50 transition-all">
            {set.isPending ? 'Salvando…' : 'Sim, quero o resumo semanal'}
          </button>
          <button type="button" onClick={() => set.mutate(false)} disabled={set.isPending}
            className="w-full font-mono text-xs font-semibold uppercase tracking-widest py-3 rounded-lg border border-line text-muted hover:text-text hover:border-line-strong disabled:opacity-50 transition-all">
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}

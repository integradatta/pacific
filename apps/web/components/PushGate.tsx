'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMe, type Me } from '@/lib/auth-redirect';
import { pushConfigured, enablePush } from '@/lib/push';

/*
 * Gate de notificações no 1º acesso do padrinho (por dispositivo). Pergunta se quer receber os
 * alertas importantes (pagamento avisado, pedido de suporte, localização, promessas) no aparelho.
 * Aceitar → pede a permissão do navegador e assina o push NA HORA (enablePush) → já começa a chegar.
 * Recusar → não pergunta de novo neste aparelho (pode ativar depois em Configurações).
 *
 * Aparece só quando: credor com termos aceitos, push suportado+configurado (VAPID), permissão ainda
 * 'default' (não concedida/bloqueada) e sem decisão salva. Espera o gate do resumo semanal decidir
 * antes (weeklyDigestOptIn !== null) para não empilhar dois modais. Montado no Shell.
 */
const KEY = 'pacific:push-optin'; // decisão por dispositivo (push é por navegador/aparelho)

export function PushGate() {
  const me = useQuery<Me>({ queryKey: ['auth-me'], queryFn: () => fetchMe(), retry: false });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = me.data;
    if (!d || d.role !== 'CREDITOR' || !d.termsAccepted) return;
    if (d.weeklyDigestOptIn === null) return; // deixa o resumo semanal decidir primeiro (sem sobrepor)
    if (!pushConfigured()) return; // sem suporte/VAPID (ex.: iOS fora do app instalado)
    if (typeof Notification === 'undefined' || Notification.permission !== 'default') return; // já concedeu/bloqueou
    if (localStorage.getItem(KEY)) return; // já decidiu neste aparelho
    setShow(true);
  }, [me.data]);

  if (!show) return null;

  async function accept() {
    setBusy(true);
    setError(null);
    const r = await enablePush();
    setBusy(false);
    if (r === 'enabled' || r === 'denied') {
      localStorage.setItem(KEY, r); // decidido (concedeu ou o navegador bloqueou) — não pergunta mais
      setShow(false);
    } else {
      // 'unsupported'/'error' → não trava o padrinho; permite seguir e tentar depois em Configurações.
      setError('Não deu para ativar agora. Você pode tentar de novo em Configurações.');
    }
  }

  function decline() {
    localStorage.setItem(KEY, 'declined');
    setShow(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(7,10,17,0.72)', backdropFilter: 'blur(4px)' }} role="dialog" aria-modal="true" aria-labelledby="pg-title">
      <div className="panel p-7 max-w-[420px] w-full animate-rise">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgb(var(--sonar) / 0.12)' }} aria-hidden>
          <span className="text-[22px]">🔔</span>
        </div>
        <h2 id="pg-title" className="font-display text-xl font-semibold text-text tracking-tight">Receber notificações?</h2>
        <p className="font-sans text-sm text-text-dim mt-2 leading-relaxed">
          Ative para receber no aparelho os avisos que importam: quando um sobrinho avisa um pagamento,
          pede ajuda, muda a localização ou uma promessa está vencendo. Você pode desligar quando quiser em Configurações.
        </p>
        {error && <p role="alert" className="font-sans text-xs text-status-red mt-3">{error}</p>}
        <div className="flex flex-col gap-2 mt-6">
          <button type="button" onClick={() => void accept()} disabled={busy}
            className="w-full bg-sonar text-ink font-mono text-xs font-semibold uppercase tracking-widest py-3 rounded-lg hover:brightness-110 active:translate-y-px disabled:opacity-50 transition-all">
            {busy ? 'Ativando…' : 'Sim, ativar notificações'}
          </button>
          <button type="button" onClick={decline} disabled={busy}
            className="w-full font-mono text-xs font-semibold uppercase tracking-widest py-3 rounded-lg border border-line text-muted hover:text-text hover:border-line-strong disabled:opacity-50 transition-all">
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}

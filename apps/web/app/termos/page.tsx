'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { apiPost } from '@/lib/api';
import { fetchMe, pathForMe } from '@/lib/auth-redirect';

export default function TermosPage() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  // Gate da própria tela: sem sessão → login; quem não precisa ver (admin, devedor, ou padrinho
  // que já aceitou) é mandado ao destino certo. Evita re-aceite e exibição para o papel errado.
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase().auth.getSession();
      if (!active) return;
      if (!data.session) {
        router.replace('/login');
        return;
      }
      try {
        const me = await fetchMe();
        if (!active) return;
        if (me.role !== 'CREDITOR' || me.termsAccepted) router.replace(pathForMe(me));
        else setChecking(false);
      } catch {
        if (active) router.replace('/login');
      }
    })();
    return () => {
      active = false;
    };
  }, [router]);

  async function confirm() {
    setLoading(true);
    setError(null);
    try {
      await apiPost('/auth/accept-terms');
      router.replace('/dashboard');
    } catch {
      setError('Não foi possível registrar o aceite. Tente novamente.');
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="flex items-center gap-2.5">
          <span className="relative flex w-2 h-2">
            <span className="absolute inline-flex w-full h-full rounded-full bg-sonar/60 animate-ping2" />
            <span className="relative inline-flex w-2 h-2 rounded-full bg-sonar" />
          </span>
          <p className="font-mono text-sm text-text-dim tracking-wider">Carregando…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg panel p-8 space-y-6 animate-rise">
        {/* Marca */}
        <div className="space-y-1.5">
          <p className="font-mono text-[11px] text-muted uppercase tracking-[0.2em] flex items-center gap-1.5">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inline-flex w-full h-full rounded-full bg-sonar/60 animate-ping2" />
              <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-sonar" />
            </span>
            torre de controle
          </p>
          <h1 className="font-display text-2xl font-semibold text-text tracking-tight">Termos de Responsabilidade</h1>
        </div>

        {/* Texto do aceite (termos + aviso legal de isenção) */}
        <div className="space-y-4 text-sm text-text-dim font-sans leading-relaxed border-l-2 border-line pl-4">
          <p>
            A <span className="text-text font-medium">Pacific</span> fornece exclusivamente infraestrutura tecnológica
            (software) para o acompanhamento de operações entre os usuários.
          </p>
          <p>
            Não somos parte das operações de crédito realizadas na plataforma e{' '}
            <span className="text-text">não nos responsabilizamos</span> pelas transações, acordos ou eventuais perdas
            entre os usuários. As decisões, valores e condições são de responsabilidade exclusiva de quem opera.
          </p>
          <p>Ao continuar, você declara estar ciente e de acordo com estes termos.</p>
        </div>

        {/* Checkbox obrigatório */}
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-line bg-surface2 accent-sonar shrink-0"
          />
          <span className="font-sans text-sm text-text">Li e aceito os termos acima.</span>
        </label>

        {error && <p role="alert" className="font-mono text-xs text-status-red">{error}</p>}

        <button
          type="button"
          onClick={confirm}
          disabled={!agreed || loading}
          className="w-full bg-sonar text-ink font-mono text-sm font-semibold uppercase tracking-widest py-2.5 rounded-lg shadow-[0_8px_24px_-10px_rgb(var(--sonar)/0.7)] hover:brightness-110 active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all"
        >
          {loading ? 'Confirmando…' : 'Confirmar e entrar'}
        </button>
      </div>
    </main>
  );
}

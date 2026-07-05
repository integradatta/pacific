'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { apiPost } from '@/lib/api';
import { fetchMe, pathForMe } from '@/lib/auth-redirect';

/* Sonar scope — o motivo do produto (torre de controle) como textura ambiente atrás da entrada.
 * Anéis de alcance concêntricos + um "ping" que expande. Discreto, aria-hidden, sem custo de layout. */
function SonarScope() {
  const rings = [90, 190, 300, 420];
  return (
    <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center overflow-hidden" aria-hidden>
      <div className="relative" style={{ width: 840, height: 840, maxWidth: '150vw', maxHeight: '150vw', WebkitMaskImage: 'radial-gradient(closest-side, black 55%, transparent 100%)', maskImage: 'radial-gradient(closest-side, black 55%, transparent 100%)' }}>
        {rings.map((r) => (
          <span key={r} className="absolute top-1/2 left-1/2 rounded-full" style={{ width: r * 2, height: r * 2, marginLeft: -r, marginTop: -r, border: '1px solid rgb(var(--sonar) / 0.06)' }} />
        ))}
        {/* eixos finos */}
        <span className="absolute top-1/2 left-0 right-0 h-px" style={{ background: 'rgb(var(--line) / 0.6)' }} />
        <span className="absolute left-1/2 top-0 bottom-0 w-px" style={{ background: 'rgb(var(--line) / 0.6)' }} />
        {/* ping expandindo — vida sutil */}
        <span className="absolute top-1/2 left-1/2 rounded-full animate-ping2" style={{ width: 180, height: 180, marginLeft: -90, marginTop: -90, border: '1px solid rgb(var(--sonar) / 0.5)' }} />
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Já autenticado ao abrir /login? Não fica preso no formulário — manda pro painel do papel.
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase().auth.getSession();
      if (!active) return;
      if (!data.session) {
        setChecking(false);
        return;
      }
      try {
        const me = await fetchMe();
        if (active) router.replace(pathForMe(me));
      } catch {
        if (active) setChecking(false); // sessão sem /auth/me acessível: mostra o formulário
      }
    })();
    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase().auth.signInWithPassword({ email, password });

    if (authError) {
      setError('Não foi possível entrar. Verifique e-mail e senha.');
      // Reporta a tentativa falha p/ o monitoramento do super-admin (endpoint público, best-effort).
      void apiPost('/public/events/login-failed', { email }).catch(() => undefined);
      setLoading(false);
      return;
    }

    // Roteia pelo papel (fonte única em pathForMe). fetchMe tem retry: uma falha transitória
    // não pode misroutar (ex.: jogar um admin no /dashboard de credor). Falha dura → mensagem.
    try {
      const me = await fetchMe();
      void apiPost('/events/session', { type: 'login' }).catch(() => undefined); // tracking (best-effort)
      router.push(pathForMe(me));
    } catch {
      setError('Entramos na sua conta, mas a plataforma não respondeu. Tente novamente em instantes.');
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
          <p className="font-mono text-sm text-text-dim tracking-wider">Verificando sessão…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <SonarScope />
      <div className="relative z-10 w-full max-w-sm panel p-8 space-y-7 animate-rise">
        {/* Brand */}
        <div className="space-y-1.5">
          <p className="font-mono text-[11px] text-muted uppercase tracking-[0.2em] flex items-center gap-1.5">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inline-flex w-full h-full rounded-full bg-sonar/60 animate-ping2" />
              <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-sonar" />
            </span>
            torre de controle
          </p>
          <h1 className="inline-flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand-mark.png" alt="" aria-hidden className="h-10 w-auto" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand-wordmark.png" alt="Pacific" className="h-7 w-auto" />
          </h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="email" className="block font-mono text-[11px] text-muted uppercase tracking-wider">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface2 border border-line rounded-lg px-3.5 py-2.5 text-text font-sans text-sm placeholder:text-muted focus:outline-none focus:border-sonar focus:shadow-glow transition-all"
              placeholder="voce@empresa.com"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block font-mono text-[11px] text-muted uppercase tracking-wider">
              Senha
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface2 border border-line rounded-lg px-3.5 py-2.5 text-text font-sans text-sm placeholder:text-muted focus:outline-none focus:border-sonar focus:shadow-glow transition-all"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p role="alert" className="font-mono text-xs text-status-red">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sonar text-ink font-mono text-sm font-semibold uppercase tracking-widest py-2.5 rounded-lg shadow-[0_8px_24px_-10px_rgb(var(--sonar)/0.7)] hover:brightness-110 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="font-mono text-xs text-muted text-center">
          Não tem conta?{' '}
          <Link href="/register" className="text-sonar hover:underline">Criar carteira</Link>
        </p>
      </div>
    </main>
  );
}

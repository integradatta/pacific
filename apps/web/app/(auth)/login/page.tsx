'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { apiGet } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase().auth.signInWithPassword({ email, password });

    if (authError) {
      setError('Não foi possível entrar. Verifique e-mail e senha.');
      setLoading(false);
      return;
    }

    // Conta autenticada mas sem carteira (tenant) -> conclui o cadastro; senão, dashboard.
    // Isso resolve o "loga mas não acessa": sem tenant, todo endpoint protegido dá 403.
    try {
      const me = await apiGet<{ role: string; tenantId: string | null; approved: boolean }>('/auth/me');
      if (me.role === 'SUPER_ADMIN') router.push('/admin');
      else if (!me.tenantId) router.push('/register');
      else if (!me.approved) router.push('/pendente');
      else router.push('/dashboard');
    } catch {
      router.push('/dashboard');
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm panel p-8 space-y-7 animate-rise">
        {/* Brand */}
        <div className="space-y-1.5">
          <p className="font-mono text-[11px] text-muted uppercase tracking-[0.2em] flex items-center gap-1.5">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inline-flex w-full h-full rounded-full bg-sonar/60 animate-ping2" />
              <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-sonar" />
            </span>
            torre de controle
          </p>
          <h1 className="font-display text-3xl font-semibold text-text tracking-tight">PACIFIC</h1>
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

'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

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

    router.push('/dashboard');
  }

  return (
    <main className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-surface border border-line rounded-xl p-8 space-y-6">
        {/* Brand */}
        <div className="space-y-1">
          <p className="font-mono text-xs text-muted uppercase tracking-widest">torre de controle</p>
          <h1 className="font-display text-3xl font-semibold text-text tracking-tight">PACIFIC</h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1">
            <label htmlFor="email" className="block font-mono text-xs text-muted uppercase tracking-wider">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface border border-line rounded-lg px-3 py-2.5 text-text font-sans text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-sonar focus:border-sonar transition-colors"
              placeholder="voce@empresa.com"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="block font-mono text-xs text-muted uppercase tracking-wider">
              Senha
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface border border-line rounded-lg px-3 py-2.5 text-text font-sans text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-sonar focus:border-sonar transition-colors"
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
            className="w-full bg-sonar text-ink font-mono text-sm font-medium uppercase tracking-widest py-2.5 rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-sonar focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
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

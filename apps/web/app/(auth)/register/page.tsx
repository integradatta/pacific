'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { apiPost } from '@/lib/api';

const inputClass =
  'w-full bg-surface border border-line rounded-lg px-3 py-2.5 text-text font-sans text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-sonar focus:border-sonar transition-colors';

export default function RegisterPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    const { data, error: signErr } = await supabase().auth.signUp({ email, password });
    if (signErr) {
      setError('Não foi possível criar a conta. Verifique os dados e tente novamente.');
      setLoading(false);
      return;
    }
    // Sem sessão imediata = confirmação de e-mail ativada no Supabase.
    if (!data.session) {
      setInfo('Conta criada. Confirme seu e-mail e depois entre para concluir o cadastro da carteira.');
      setLoading(false);
      return;
    }
    try {
      await apiPost('/auth/register-creditor', { orgName });
      router.push('/dashboard');
    } catch {
      setError('Conta criada, mas falhou ao registrar a carteira. Tente entrar novamente.');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-surface border border-line rounded-xl p-8 space-y-6">
        <div className="space-y-1">
          <p className="font-mono text-xs text-muted uppercase tracking-widest">torre de controle</p>
          <h1 className="font-display text-3xl font-semibold text-text tracking-tight">PACIFIC</h1>
          <p className="font-sans text-sm text-muted">Crie sua carteira</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1">
            <label htmlFor="orgName" className="block font-mono text-xs text-muted uppercase tracking-wider">Nome da carteira</label>
            <input id="orgName" required value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Minha Carteira" className={inputClass} />
          </div>
          <div className="space-y-1">
            <label htmlFor="email" className="block font-mono text-xs text-muted uppercase tracking-wider">E-mail</label>
            <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" className={inputClass} />
          </div>
          <div className="space-y-1">
            <label htmlFor="password" className="block font-mono text-xs text-muted uppercase tracking-wider">Senha</label>
            <input id="password" type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={inputClass} />
          </div>

          {error && <p role="alert" className="font-mono text-xs text-status-red">{error}</p>}
          {info && <p role="status" className="font-mono text-xs text-sonar">{info}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sonar text-ink font-mono text-sm font-medium uppercase tracking-widest py-2.5 rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-sonar focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {loading ? 'Criando…' : 'Criar carteira'}
          </button>
        </form>

        <p className="font-mono text-xs text-muted text-center">
          Já tem conta?{' '}
          <Link href="/login" className="text-sonar hover:underline">Entrar</Link>
        </p>
      </div>
    </main>
  );
}

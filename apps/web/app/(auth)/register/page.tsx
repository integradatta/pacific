'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { apiGet, apiPost } from '@/lib/api';

const inputClass =
  'w-full bg-surface2 border border-line rounded-lg px-3.5 py-2.5 text-text font-sans text-sm placeholder:text-muted focus:outline-none focus:border-sonar focus:shadow-glow transition-all';

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
    let session = data?.session ?? null;

    if (signErr) {
      // E-mail já cadastrado: tenta logar e concluir a carteira (recupera conta sem carteira).
      const msg = signErr.message?.toLowerCase() ?? '';
      const alreadyExists = signErr.status === 422 || msg.includes('already') || msg.includes('registered');
      if (!alreadyExists) {
        setError('Não foi possível criar a conta. Verifique os dados e tente novamente.');
        setLoading(false);
        return;
      }
      const { data: signInData, error: signInErr } = await supabase().auth.signInWithPassword({ email, password });
      if (signInErr) {
        setError('Este e-mail já tem conta. Confira a senha ou use "Entrar".');
        setLoading(false);
        return;
      }
      session = signInData.session;
    }

    // Sem sessão = confirmação de e-mail ativada no Supabase.
    if (!session) {
      setInfo('Conta criada. Confirme seu e-mail e depois entre para concluir o cadastro da carteira.');
      setLoading(false);
      return;
    }
    try {
      // Idempotente no backend: cria a carteira ou devolve a existente.
      await apiPost('/auth/register-creditor', { orgName });
      // Conta nova entra PENDENTE → vai pra tela "em análise". Recuperação de conta já aprovada → dashboard.
      const me = await apiGet<{ approved: boolean }>('/auth/me');
      router.push(me.approved ? '/dashboard' : '/pendente');
    } catch {
      setError('Não foi possível concluir o cadastro da carteira. Tente novamente.');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm panel p-8 space-y-6 animate-rise">
        <div className="space-y-1.5">
          <p className="font-mono text-[11px] text-muted uppercase tracking-[0.2em] flex items-center gap-1.5">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inline-flex w-full h-full rounded-full bg-sonar/60 animate-ping2" />
              <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-sonar" />
            </span>
            torre de controle
          </p>
          <h1 className="font-display text-3xl font-semibold text-text tracking-tight">PACIFIC</h1>
          <p className="font-sans text-sm text-text-dim">Crie sua carteira</p>
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
            className="w-full bg-sonar text-ink font-mono text-sm font-semibold uppercase tracking-widest py-2.5 rounded-lg shadow-[0_8px_24px_-10px_rgb(var(--sonar)/0.7)] hover:brightness-110 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
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

'use client';

import { useEffect, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { getDebtorJwt } from '@/lib/debtor';
import { supabase } from '@/lib/supabase';
import { fetchMe, pathForMe } from '@/lib/auth-redirect';

// Entrada única — também é o start_url do PWA. Roteia por QUEM está logado, não por uma rota fixa,
// pra o atalho na tela inicial abrir a interface certa de cada pessoa:
//  1) Sobrinho (devedor): JWT próprio no localStorage → /me (não usa sessão Supabase).
//  2) Padrinho/admin: sessão Supabase → painel por papel (pathForMe: /admin ou /dashboard).
//  3) Ninguém logado → /login.
export default function Home(): ReactElement {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    void (async () => {
      if (getDebtorJwt()) {
        router.replace('/me');
        return;
      }
      const { data } = await supabase().auth.getSession();
      if (!active) return;
      if (data.session) {
        try {
          const me = await fetchMe();
          if (active) router.replace(pathForMe(me));
        } catch {
          if (active) router.replace('/login');
        }
        return;
      }
      router.replace('/login');
    })();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#070A11]">
      <p className="font-mono text-xs text-white/40 uppercase tracking-widest">Abrindo…</p>
    </main>
  );
}

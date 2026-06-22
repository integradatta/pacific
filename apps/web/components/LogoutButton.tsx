'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { apiPost } from '@/lib/api';

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    // Registra o logout enquanto ainda há sessão; depois encerra de fato.
    await apiPost('/events/session', { type: 'logout' }).catch(() => undefined);
    await supabase().auth.signOut().catch(() => undefined);
    router.push('/login');
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      aria-label="Sair"
      className={className ?? 'font-mono text-[10px] text-muted hover:text-status-red uppercase tracking-widest transition-colors disabled:opacity-50'}
    >
      {busy ? 'Saindo…' : 'Sair'}
    </button>
  );
}

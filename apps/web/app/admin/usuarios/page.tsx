'use client';

import { useState } from 'react';
import type { AdminUserRow } from '@pacific/shared';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminBadge } from '@/components/admin/ui';
import { useAdminUsers, useRequestPasswordReset, useForceLogoutUser } from '@/lib/admin';

const ROLE_TONE = { OWNER: 'iris', SUPER_ADMIN: 'iris', CREDITOR: 'green', DEBTOR: 'muted' } as const;
const btn = 'font-mono text-[10px] uppercase tracking-widest border rounded px-2.5 py-1 transition-colors disabled:opacity-50';

function Actions({ u }: { u: AdminUserRow }) {
  const reset = useRequestPasswordReset();
  const logout = useForceLogoutUser();
  const [msg, setMsg] = useState<string | null>(null);

  function doReset() {
    reset.mutate(u.id, {
      onSuccess: () => setMsg('link de reset enviado'),
      onError: () => setMsg('falha — verifique a chave do Supabase'),
    });
  }
  function doLogout() {
    if (!window.confirm(`Forçar logout de ${u.email}? As sessões ativas caem imediatamente.`)) return;
    logout.mutate(u.id, { onSuccess: () => setMsg('sessões encerradas'), onError: () => setMsg('falha ao encerrar') });
  }
  const busy = reset.isPending || logout.isPending;
  return (
    <div className="flex items-center gap-2 justify-end flex-wrap">
      {msg && <span className="font-mono text-[10px] text-muted">{msg}</span>}
      <button type="button" onClick={doReset} disabled={busy} className={`${btn} text-iris border-iris/40 hover:bg-iris/10`}>Reset de senha</button>
      <button type="button" onClick={doLogout} disabled={busy} className={`${btn} text-status-red border-status-red/40 hover:bg-status-red/10`}>Forçar logout</button>
    </div>
  );
}

export default function UsuariosPage() {
  const users = useAdminUsers();
  const [q, setQ] = useState('');
  const rows = (users.data ?? []).filter((u) => u.email.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <AdminShell title="Usuários">
      <div className="space-y-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por e-mail…" className="w-full max-w-md bg-surface2 border border-line rounded-lg px-3.5 py-2 text-text font-sans text-sm placeholder:text-muted focus:outline-none focus:border-iris focus:shadow-glow transition-all" />
        <section className="panel overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="font-mono text-[10px] text-muted uppercase tracking-widest border-b border-line">
                <th className="text-left font-normal px-6 py-2.5">E-mail</th>
                <th className="text-left font-normal px-6 py-2.5">Papel</th>
                <th className="text-left font-normal px-6 py-2.5">Carteira</th>
                <th className="text-right font-normal px-6 py-2.5">Criado</th>
                <th className="text-right font-normal px-6 py-2.5">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-t border-line/70 hover:bg-iris/[0.03] transition-colors">
                  <td className="px-6 py-3 font-sans text-sm text-text truncate max-w-[220px]">{u.email}</td>
                  <td className="px-6 py-3"><AdminBadge tone={ROLE_TONE[u.role]}>{u.role}</AdminBadge></td>
                  <td className="px-6 py-3 font-mono text-xs text-muted">{u.tenantId ? `${u.tenantId.slice(0, 8)}…` : 'plataforma'}</td>
                  <td className="px-6 py-3 font-mono text-xs text-muted text-right tabular-nums">{new Date(u.createdAt).toLocaleDateString('pt-BR')}</td>
                  <td className="px-6 py-3"><Actions u={u} /></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="px-6 py-6 text-center font-sans text-sm text-text-dim">{users.isLoading ? 'Carregando…' : 'Nenhum usuário encontrado.'}</td></tr>}
            </tbody>
          </table>
        </section>
        <p className="font-mono text-[10px] text-muted tracking-wider">
          Senhas nunca são exibidas (hash no Supabase). O controle seguro é reset + força logout, tudo auditado.
        </p>
      </div>
    </AdminShell>
  );
}

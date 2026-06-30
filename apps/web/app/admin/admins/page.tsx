'use client';

import { useState } from 'react';
import type { AdminUserRow } from '@pacific/shared';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminBadge } from '@/components/admin/ui';
import { useAdminAdmins, useAdminUsers, useRevokeAdmin, usePromoteAdmin } from '@/lib/admin';

const btn = 'font-mono text-[10px] uppercase tracking-widest border rounded px-2.5 py-1 transition-colors disabled:opacity-50';

function AdminRow({ a }: { a: AdminUserRow }) {
  const revoke = useRevokeAdmin();
  const isOwner = a.role === 'OWNER';
  function doRevoke() {
    if (!window.confirm(`Revogar o acesso de ${a.email}? Ele deixa de ser administrador e as sessões caem imediatamente.`)) return;
    revoke.mutate(a.id);
  }
  return (
    <tr className="border-t border-line/70">
      <td className="px-6 py-3 font-sans text-sm text-text truncate max-w-[240px]">{a.email}</td>
      <td className="px-6 py-3"><AdminBadge tone={isOwner ? 'iris' : 'green'}>{isOwner ? 'PROPRIETÁRIO' : 'SUPER ADMIN'}</AdminBadge></td>
      <td className="px-6 py-3 font-mono text-xs text-muted text-right tabular-nums">{new Date(a.createdAt).toLocaleDateString('pt-BR')}</td>
      <td className="px-6 py-3 text-right">
        {isOwner ? (
          <span className="font-mono text-[10px] text-muted uppercase tracking-widest">acesso máximo</span>
        ) : (
          <button type="button" onClick={doRevoke} disabled={revoke.isPending} className={`${btn} text-status-red border-status-red/40 hover:bg-status-red/10`}>Revogar acesso</button>
        )}
      </td>
    </tr>
  );
}

export default function AdminsPage() {
  const admins = useAdminAdmins();
  const users = useAdminUsers();
  const promote = usePromoteAdmin();
  const [q, setQ] = useState('');

  const candidates = (users.data ?? [])
    .filter((u) => u.role === 'CREDITOR' && u.email.toLowerCase().includes(q.trim().toLowerCase()))
    .slice(0, 8);

  return (
    <AdminShell title="Admin Supremo">
      <div className="space-y-6">
        {/* Administradores atuais */}
        <section className="panel overflow-hidden">
          <div className="px-6 py-4 border-b border-line">
            <h2 className="font-display text-lg font-semibold text-text tracking-tight">Administradores</h2>
            <p className="font-mono text-[10px] text-muted uppercase tracking-widest mt-0.5">o proprietário pode revogar o acesso de um super-admin</p>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="font-mono text-[10px] text-muted uppercase tracking-widest border-b border-line">
                <th className="text-left font-normal px-6 py-2.5">E-mail</th>
                <th className="text-left font-normal px-6 py-2.5">Papel</th>
                <th className="text-right font-normal px-6 py-2.5">Criado</th>
                <th className="text-right font-normal px-6 py-2.5">Ação</th>
              </tr>
            </thead>
            <tbody>
              {(admins.data ?? []).map((a) => <AdminRow key={a.id} a={a} />)}
              {(admins.data ?? []).length === 0 && (
                <tr><td colSpan={4} className="px-6 py-6 text-center font-sans text-sm text-text-dim">{admins.isLoading ? 'Carregando…' : admins.isError ? 'Acesso restrito ao proprietário.' : 'Nenhum administrador.'}</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </section>

        {/* Promover um usuário a administrador */}
        <section className="panel p-6 space-y-3">
          <h2 className="font-display text-base font-semibold text-text tracking-tight">Promover a administrador</h2>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar usuário por e-mail…" className="w-full max-w-md bg-surface2 border border-line rounded-lg px-3.5 py-2 text-text font-sans text-sm placeholder:text-muted focus:outline-none focus:border-iris transition-all" />
          <ul className="divide-y divide-line/70">
            {q.trim() && candidates.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="font-sans text-sm text-text-dim truncate">{u.email}</span>
                <button type="button" onClick={() => promote.mutate(u.id)} disabled={promote.isPending} className={`${btn} text-iris border-iris/40 hover:bg-iris/10`}>Promover</button>
              </li>
            ))}
            {q.trim() && candidates.length === 0 && <li className="py-2.5 font-sans text-sm text-text-dim">Nenhum usuário encontrado.</li>}
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}

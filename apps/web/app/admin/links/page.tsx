'use client';

import { AdminShell } from '@/components/admin/AdminShell';
import { AdminBadge } from '@/components/admin/ui';
import { useAdminLinks, useRevokeLink } from '@/lib/admin';

export default function LinksPage() {
  const links = useAdminLinks();
  const revoke = useRevokeLink();
  const rows = links.data ?? [];

  return (
    <AdminShell title="Links de acesso">
      <section className="panel overflow-hidden">
        <div className="px-6 py-4 border-b border-line flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold text-text tracking-tight">Links de sobrinhos</h2>
          <span className="font-mono text-[10px] text-muted uppercase tracking-widest tabular-nums">{rows.length} · {rows.filter((l) => l.active).length} ativos</span>
        </div>
        <table className="w-full">
          <thead>
            <tr className="font-mono text-[10px] text-muted uppercase tracking-widest border-b border-line">
              <th className="text-left font-normal px-6 py-2.5">Sobrinho</th>
              <th className="text-left font-normal px-6 py-2.5">Carteira</th>
              <th className="text-left font-normal px-6 py-2.5">Estado</th>
              <th className="text-right font-normal px-6 py-2.5">Último acesso</th>
              <th className="text-right font-normal px-6 py-2.5">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} className="border-t border-line/70 hover:bg-iris/[0.03] transition-colors">
                <td className="px-6 py-3 font-mono text-xs text-text-dim">{l.debtorId.slice(0, 8)}…</td>
                <td className="px-6 py-3 font-mono text-xs text-muted">{l.tenantId.slice(0, 8)}…</td>
                <td className="px-6 py-3"><AdminBadge tone={l.active ? 'green' : 'muted'}>{l.active ? 'ativo' : 'revogado'}</AdminBadge></td>
                <td className="px-6 py-3 font-mono text-xs text-muted text-right tabular-nums">{l.lastSeenAt ? new Date(l.lastSeenAt).toLocaleString('pt-BR') : 'nunca'}</td>
                <td className="px-6 py-3 text-right">
                  {l.active && <button type="button" disabled={revoke.isPending} onClick={() => revoke.mutate(l.id)} className="font-mono text-[10px] uppercase tracking-widest text-status-red border border-status-red/40 rounded px-2.5 py-1 hover:bg-status-red/10 disabled:opacity-50">Revogar</button>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="px-6 py-6 text-center font-sans text-sm text-text-dim">{links.isLoading ? 'Carregando…' : 'Nenhum link gerado ainda.'}</td></tr>}
          </tbody>
        </table>
      </section>
    </AdminShell>
  );
}

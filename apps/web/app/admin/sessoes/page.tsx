'use client';

import { AdminShell } from '@/components/admin/AdminShell';
import { AdminBadge } from '@/components/admin/ui';
import { useAdminEvents } from '@/lib/admin';

// Acessos (login/logout). Observação: o login do credor é gerido pelo Supabase; rastreamos o
// evento de sessão (ator, tipo, IP, horário). Device/navegador/localização não são capturados.
export default function SessoesPage() {
  const events = useAdminEvents();
  const rows = (events.data ?? []).filter((e) => e.type === 'LOGIN' || e.type === 'LOGOUT' || e.type === 'LINK_USED');

  return (
    <AdminShell title="Sessões e acessos">
      <section className="panel overflow-hidden">
        <div className="px-6 py-4 border-b border-line flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold text-text tracking-tight">Acessos recentes</h2>
          <span className="font-mono text-[10px] text-muted uppercase tracking-widest tabular-nums">{rows.length}</span>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr className="font-mono text-[10px] text-muted uppercase tracking-widest border-b border-line">
              <th className="text-left font-normal px-6 py-2.5">Tipo</th>
              <th className="text-left font-normal px-6 py-2.5">Quem</th>
              <th className="text-left font-normal px-6 py-2.5">Carteira</th>
              <th className="text-right font-normal px-6 py-2.5">Quando</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-t border-line/70">
                <td className="px-6 py-3"><AdminBadge tone={e.type === 'LOGOUT' ? 'muted' : 'iris'}>{e.type}</AdminBadge></td>
                <td className="px-6 py-3 font-mono text-xs text-text-dim">{e.actorType.toLowerCase()}{e.actorId ? ` · ${e.actorId.slice(0, 10)}…` : ''}</td>
                <td className="px-6 py-3 font-mono text-xs text-muted">{e.tenantId ? `${e.tenantId.slice(0, 8)}…` : 'plataforma'}</td>
                <td className="px-6 py-3 font-mono text-xs text-muted text-right tabular-nums">{new Date(e.at).toLocaleString('pt-BR')}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="px-6 py-6 text-center font-sans text-sm text-text-dim">{events.isLoading ? 'Carregando…' : 'Nenhum acesso registrado ainda.'}</td></tr>}
          </tbody>
        </table>
        </div>
        <p className="px-6 py-3 border-t border-line font-mono text-[10px] text-muted tracking-wider">
          device · navegador · localização não são capturados (sessões geridas pelo Supabase).
        </p>
      </section>
    </AdminShell>
  );
}

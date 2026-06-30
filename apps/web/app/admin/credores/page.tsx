'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { AdminCreditorRow } from '@pacific/shared';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminBadge } from '@/components/admin/ui';
import { useAdminCreditors, useTenantAction, useDeleteTenant, type TenantAction } from '@/lib/admin';
import { formatBRL } from '@/lib/format';
import { toast } from '@/components/Toast';

const btn = 'font-mono text-[10px] uppercase tracking-widest border rounded px-2.5 py-1 transition-colors disabled:opacity-50';

// Rótulos das ações que pedem confirmação com o nome do padrinho + a mensagem do toast.
const ACTION_COPY: Partial<Record<TenantAction, { confirm: (name: string) => string; ok: string }>> = {
  suspend: { confirm: (n) => `Tem certeza que deseja suspender ${n}? Ele perde o acesso até ser reativado.`, ok: 'Padrinho suspenso.' },
  reactivate: { confirm: (n) => `Reativar ${n}? O acesso volta imediatamente.`, ok: 'Padrinho reativado.' },
  unblock: { confirm: (n) => `Reativar ${n}? O acesso volta imediatamente.`, ok: 'Padrinho reativado.' },
};

function Actions({ c }: { c: AdminCreditorRow }) {
  const action = useTenantAction();
  const del = useDeleteTenant();
  function run(a: TenantAction) {
    const copy = ACTION_COPY[a];
    if (copy && !window.confirm(copy.confirm(c.name))) return;
    action.mutate(
      { id: c.tenantId, action: a },
      {
        onSuccess: () => toast(copy?.ok ?? 'Ação concluída.', 'success'),
        onError: () => toast('Não foi possível concluir a ação.', 'error'),
      },
    );
  }
  function remove() {
    const typed = window.prompt(`Excluir "${c.name}" e TODOS os seus dados é irreversível.\nDigite o código da organização (${c.orgCode}) para confirmar:`);
    if (typed != null) del.mutate({ id: c.tenantId, confirmOrgCode: typed.trim() });
  }
  const pending = action.isPending || del.isPending;
  return (
    <div className="flex gap-2 justify-end flex-wrap">
      <Link href={`/admin/credores/${c.tenantId}`} className={`${btn} text-iris border-iris/40 hover:bg-iris/10`}>Inspecionar carteira</Link>
      {c.approval === 'PENDING' && <button type="button" onClick={() => run('approve')} disabled={pending} className={`${btn} text-iris border-iris/40 hover:bg-iris/10`}>Aprovar</button>}
      {c.status === 'ACTIVE' && c.approval === 'APPROVED' && <button type="button" onClick={() => run('suspend')} disabled={pending} className={`${btn} text-status-yellow border-status-yellow/40 hover:bg-status-yellow/10`}>Suspender</button>}
      {c.status === 'ACTIVE' && c.approval === 'APPROVED' && <button type="button" onClick={() => run('block')} disabled={pending} className={`${btn} text-status-red border-status-red/40 hover:bg-status-red/10`}>Bloquear</button>}
      {c.status === 'SUSPENDED' && <button type="button" onClick={() => run('unblock')} disabled={pending} className={`${btn} text-sonar border-sonar/40 hover:bg-sonar/10`}>Reativar</button>}
      <button type="button" onClick={remove} disabled={pending} className={`${btn} text-status-red border-status-red/40 hover:bg-status-red/20`}>Excluir</button>
    </div>
  );
}

function CredoresInner() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const all = useAdminCreditors();
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (all.data ?? []).filter((c) => !needle || c.name.toLowerCase().includes(needle) || c.orgCode.toLowerCase().includes(needle) || (c.email ?? '').toLowerCase().includes(needle));
  }, [all.data, q]);

  return (
    <AdminShell title="Padrinhos">
      <div className="space-y-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por nome, org ou e-mail…" className="w-full max-w-md bg-surface2 border border-line rounded-lg px-3.5 py-2 text-text font-sans text-sm placeholder:text-muted focus:outline-none focus:border-iris focus:shadow-glow transition-all" />
        <section className="panel overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="font-mono text-[10px] text-muted uppercase tracking-widest border-b border-line">
                <th className="text-left font-normal px-6 py-2.5">Padrinho</th>
                <th className="text-left font-normal px-6 py-2.5">E-mail</th>
                <th className="text-right font-normal px-6 py-2.5">Operações</th>
                <th className="text-right font-normal px-6 py-2.5">A receber</th>
                <th className="text-left font-normal px-6 py-2.5">Situação</th>
                <th className="text-right font-normal px-6 py-2.5">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.tenantId} className="border-t border-line/70 hover:bg-iris/[0.03] transition-colors">
                  <td className="px-6 py-3"><Link href={`/admin/credores/${c.tenantId}`} className="font-sans text-sm text-text hover:text-iris transition-colors">{c.name}</Link> <span className="font-mono text-xs text-muted">{c.orgCode}</span></td>
                  <td className="px-6 py-3 font-sans text-sm text-text-dim truncate max-w-[200px]">{c.email ?? '—'}</td>
                  <td className="px-6 py-3 font-mono text-sm text-text-dim text-right tabular-nums">{c.operationsCount}</td>
                  <td className="px-6 py-3 font-mono text-sm text-text text-right tabular-nums">{formatBRL(c.walletValue)}</td>
                  <td className="px-6 py-3"><span className="flex gap-1.5"><AdminBadge tone={c.approval === 'APPROVED' ? 'green' : c.approval === 'PENDING' ? 'yellow' : 'red'}>{c.approval}</AdminBadge>{c.status === 'SUSPENDED' && <AdminBadge tone="red">susp</AdminBadge>}</span></td>
                  <td className="px-6 py-3"><Actions c={c} /></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="px-6 py-6 text-center font-sans text-sm text-text-dim">{all.isLoading ? 'Carregando…' : 'Nenhum padrinho encontrado.'}</td></tr>}
            </tbody>
          </table>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

export default function CredoresPage() {
  return (
    <Suspense fallback={<AdminShell title="Padrinhos"><p className="font-mono text-sm text-muted animate-pulse">Carregando…</p></AdminShell>}>
      <CredoresInner />
    </Suspense>
  );
}

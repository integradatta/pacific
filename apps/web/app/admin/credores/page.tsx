'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { AdminCreditorRow } from '@pacific/shared';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminBadge } from '@/components/admin/ui';
import { useAdminCreditors, useTenantAction, type TenantAction } from '@/lib/admin';
import { formatBRL } from '@/lib/format';

function Actions({ c }: { c: AdminCreditorRow }) {
  const action = useTenantAction();
  const run = (a: TenantAction) => action.mutate({ id: c.tenantId, action: a });
  return (
    <div className="flex gap-2 justify-end flex-wrap">
      {c.approval === 'PENDING' && <button type="button" onClick={() => run('approve')} disabled={action.isPending} className="font-mono text-[10px] uppercase tracking-widest text-iris border border-iris/40 rounded px-2.5 py-1 hover:bg-iris/10 disabled:opacity-50">Aprovar</button>}
      {c.status === 'ACTIVE' && c.approval === 'APPROVED' && <button type="button" onClick={() => run('suspend')} disabled={action.isPending} className="font-mono text-[10px] uppercase tracking-widest text-status-red border border-status-red/40 rounded px-2.5 py-1 hover:bg-status-red/10 disabled:opacity-50">Suspender</button>}
      {c.status === 'SUSPENDED' && <button type="button" onClick={() => run('reactivate')} disabled={action.isPending} className="font-mono text-[10px] uppercase tracking-widest text-sonar border border-sonar/40 rounded px-2.5 py-1 hover:bg-sonar/10 disabled:opacity-50">Reativar</button>}
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
    <AdminShell title="Credores">
      <div className="space-y-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por nome, org ou e-mail…" className="w-full max-w-md bg-surface2 border border-line rounded-lg px-3.5 py-2 text-text font-sans text-sm placeholder:text-muted focus:outline-none focus:border-iris focus:shadow-glow transition-all" />
        <section className="panel overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="font-mono text-[10px] text-muted uppercase tracking-widest border-b border-line">
                <th className="text-left font-normal px-6 py-2.5">Credor</th>
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
                  <td className="px-6 py-3"><span className="font-sans text-sm text-text">{c.name}</span> <span className="font-mono text-xs text-muted">{c.orgCode}</span></td>
                  <td className="px-6 py-3 font-sans text-sm text-text-dim truncate max-w-[200px]">{c.email ?? '—'}</td>
                  <td className="px-6 py-3 font-mono text-sm text-text-dim text-right tabular-nums">{c.operationsCount}</td>
                  <td className="px-6 py-3 font-mono text-sm text-text text-right tabular-nums">{formatBRL(c.walletValue)}</td>
                  <td className="px-6 py-3"><span className="flex gap-1.5"><AdminBadge tone={c.approval === 'APPROVED' ? 'green' : c.approval === 'PENDING' ? 'yellow' : 'red'}>{c.approval}</AdminBadge>{c.status === 'SUSPENDED' && <AdminBadge tone="red">susp</AdminBadge>}</span></td>
                  <td className="px-6 py-3"><Actions c={c} /></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="px-6 py-6 text-center font-sans text-sm text-text-dim">{all.isLoading ? 'Carregando…' : 'Nenhum credor encontrado.'}</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
    </AdminShell>
  );
}

export default function CredoresPage() {
  return (
    <Suspense fallback={<AdminShell title="Credores"><p className="font-mono text-sm text-muted animate-pulse">Carregando…</p></AdminShell>}>
      <CredoresInner />
    </Suspense>
  );
}

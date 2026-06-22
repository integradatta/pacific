'use client';

import Link from 'next/link';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminBadge, KpiCard } from '@/components/admin/ui';
import { useAdminCreditors, useAdminLinks, useAdminOverview, useTenantAction } from '@/lib/admin';

export default function SegurancaPage() {
  const creditors = useAdminCreditors();
  const links = useAdminLinks();
  const overview = useAdminOverview();
  const action = useTenantAction();
  const suspended = (creditors.data ?? []).filter((c) => c.status === 'SUSPENDED');
  const activeLinks = (links.data ?? []).filter((l) => l.active).length;

  return (
    <AdminShell title="Segurança">
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Carteiras bloqueadas" value={overview.data ? String(overview.data.creditorsBlocked) : '—'} tone={overview.data && overview.data.creditorsBlocked > 0 ? 'red' : undefined} />
          <KpiCard label="Pendentes de aprovação" value={overview.data ? String(overview.data.creditorsPending) : '—'} tone="iris" />
          <KpiCard label="Links ativos" value={String(activeLinks)} />
          <KpiCard label="Acessos hoje" value={overview.data ? String(overview.data.loginsToday) : '—'} tone="sonar" />
        </div>

        <section className="panel overflow-hidden">
          <div className="px-6 py-4 border-b border-line flex items-baseline justify-between">
            <h2 className="font-display text-base font-semibold text-text tracking-tight">Carteiras suspensas</h2>
            <Link href="/admin/links" className="font-mono text-[10px] text-iris uppercase tracking-widest hover:underline">gerenciar links →</Link>
          </div>
          {suspended.length === 0 ? (
            <p className="px-6 py-4 font-sans text-sm text-text-dim">Nenhuma carteira suspensa.</p>
          ) : (
            <ul className="divide-y divide-line/70">
              {suspended.map((c) => (
                <li key={c.tenantId} className="px-6 py-3 flex items-center justify-between gap-3">
                  <span className="font-sans text-sm text-text truncate">{c.name} <AdminBadge tone="red">suspensa</AdminBadge></span>
                  <button type="button" disabled={action.isPending} onClick={() => action.mutate({ id: c.tenantId, action: 'reactivate' })} className="font-mono text-[10px] uppercase tracking-widest text-sonar border border-sonar/40 rounded px-2.5 py-1 hover:bg-sonar/10 disabled:opacity-50">Reativar</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AdminShell>
  );
}

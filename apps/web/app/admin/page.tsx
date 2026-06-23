'use client';

import Link from 'next/link';
import { AdminShell } from '@/components/admin/AdminShell';
import { Constellation } from '@/components/admin/Constellation';
import { KpiCard, AdminBadge } from '@/components/admin/ui';
import { useAdminOverview, useAdminCreditors, useAdminTenants, useAdminAuditFiltered, useTenantAction } from '@/lib/admin';
import { formatBRL } from '@/lib/format';

export default function AdminOverviewPage() {
  const overview = useAdminOverview();
  const creditors = useAdminCreditors();
  const pending = useAdminTenants('PENDING');
  const audit = useAdminAuditFiltered();
  const action = useTenantAction();
  const o = overview.data;

  return (
    <AdminShell title="Visão geral">
      <div className="space-y-6">
        {/* Faixa de KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Padrinhos" value={o ? String(o.creditorsTotal) : '—'} sub={o ? `${o.creditorsActive} ativos · ${o.newCreditorsToday} hoje` : ''} tone="iris" />
          <KpiCard label="Aguardando aprovação" value={o ? String(o.creditorsPending) : '—'} sub={o ? `${o.creditorsBlocked} bloqueados` : ''} tone={o && o.creditorsPending > 0 ? 'red' : undefined} />
          <KpiCard label="Volume em ajuda" value={o ? formatBRL(o.volumeLent) : '—'} sub={o ? `${o.operationsTotal} operações` : ''} />
          <KpiCard label="A receber" value={o ? formatBRL(o.outstanding) : '—'} sub={o ? `${o.operationsOverdue} vencidas` : ''} />
        </div>

        {/* Assinatura */}
        {creditors.data ? <Constellation creditors={creditors.data} /> : <div className="panel p-6"><div className="skeleton h-64 w-full rounded-lg" /></div>}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Aprovações pendentes (ação rápida) */}
          <section className="panel overflow-hidden">
            <div className="px-6 py-4 border-b border-line flex items-baseline justify-between">
              <h2 className="font-display text-base font-semibold text-text tracking-tight">Aprovações pendentes</h2>
              <Link href="/admin/aprovacoes" className="font-mono text-[10px] text-iris uppercase tracking-widest hover:underline">ver todas</Link>
            </div>
            <ul className="divide-y divide-line/70">
              {(pending.data ?? []).slice(0, 5).map((t) => (
                <li key={t.id} className="px-6 py-3 flex items-center justify-between gap-3">
                  <span className="font-sans text-sm text-text truncate">{t.name} <span className="text-muted font-mono text-xs">{t.orgCode}</span></span>
                  <span className="flex gap-2 shrink-0">
                    <button type="button" disabled={action.isPending} onClick={() => action.mutate({ id: t.id, action: 'approve' })} className="font-mono text-[10px] uppercase tracking-widest text-iris border border-iris/40 rounded px-2.5 py-1 hover:bg-iris/10 disabled:opacity-50">Aprovar</button>
                    <button type="button" disabled={action.isPending} onClick={() => action.mutate({ id: t.id, action: 'reject' })} className="font-mono text-[10px] uppercase tracking-widest text-status-red border border-status-red/40 rounded px-2.5 py-1 hover:bg-status-red/10 disabled:opacity-50">Rejeitar</button>
                  </span>
                </li>
              ))}
              {(pending.data ?? []).length === 0 && <li className="px-6 py-4 font-sans text-sm text-text-dim">Nada aguardando. Tudo em dia.</li>}
            </ul>
          </section>

          {/* Atividade recente (auditoria) */}
          <section className="panel overflow-hidden">
            <div className="px-6 py-4 border-b border-line flex items-baseline justify-between">
              <h2 className="font-display text-base font-semibold text-text tracking-tight">Atividade recente</h2>
              <Link href="/admin/auditoria" className="font-mono text-[10px] text-iris uppercase tracking-widest hover:underline">auditoria</Link>
            </div>
            <ul className="divide-y divide-line/70 max-h-72 overflow-y-auto">
              {(audit.data ?? []).slice(0, 8).map((a) => (
                <li key={a.id} className="px-6 py-2.5">
                  <p className="font-mono text-xs text-text">{a.action} <AdminBadge tone="muted">{a.targetType}</AdminBadge></p>
                  <p className="font-mono text-[10px] text-muted tabular-nums">{a.actorEmail ?? '—'} · {new Date(a.createdAt).toLocaleString('pt-BR')}</p>
                </li>
              ))}
              {(audit.data ?? []).length === 0 && <li className="px-6 py-4 font-sans text-sm text-text-dim">Sem registros ainda.</li>}
            </ul>
          </section>
        </div>
      </div>
    </AdminShell>
  );
}

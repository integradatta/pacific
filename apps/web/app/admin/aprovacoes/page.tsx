'use client';

import { AdminShell } from '@/components/admin/AdminShell';
import { useAdminTenants, useTenantAction } from '@/lib/admin';

export default function AprovacoesPage() {
  const pending = useAdminTenants('PENDING');
  const action = useTenantAction();
  const rows = pending.data ?? [];

  return (
    <AdminShell title="Central de aprovação">
      <section className="panel overflow-hidden max-w-3xl">
        <div className="px-6 py-4 border-b border-line flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold text-text tracking-tight">Contas aguardando aprovação</h2>
          <span className="font-mono text-[10px] text-muted uppercase tracking-widest tabular-nums">{rows.length}</span>
        </div>
        {pending.isLoading ? (
          <p className="px-6 py-4 font-mono text-sm text-muted animate-pulse">Carregando…</p>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-mono text-2xl text-muted/60 mb-3" aria-hidden>✓</p>
            <p className="font-sans text-sm text-text-dim">Nada aguardando aprovação. Tudo em dia.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line/70">
            {rows.map((t) => (
              <li key={t.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-sans text-sm text-text">{t.name}</p>
                  <p className="font-mono text-[11px] text-muted tabular-nums">{t.orgCode} · {t.userCount} usuário(s) · criado {new Date(t.createdAt).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button type="button" disabled={action.isPending} onClick={() => action.mutate({ id: t.id, action: 'approve' })} className="font-mono text-[11px] uppercase tracking-widest text-ink bg-iris rounded px-3 py-1.5 font-semibold hover:brightness-110 disabled:opacity-50">Aprovar</button>
                  <button type="button" disabled={action.isPending} onClick={() => action.mutate({ id: t.id, action: 'reject' })} className="font-mono text-[11px] uppercase tracking-widest text-status-red border border-status-red/40 rounded px-3 py-1.5 hover:bg-status-red/10 disabled:opacity-50">Rejeitar</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}

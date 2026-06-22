'use client';

import type { AdminTenantRow } from '@pacific/shared';
import { useAdminTenants, useAdminUsers, useAdminAudit, useTenantAction, type TenantAction } from '@/lib/admin';

function Badge({ children, tone }: { children: React.ReactNode; tone: 'green' | 'yellow' | 'red' | 'muted' }) {
  const cls = {
    green: 'text-status-green border-status-green/40 bg-status-green/10',
    yellow: 'text-status-yellow border-status-yellow/40 bg-status-yellow/10',
    red: 'text-status-red border-status-red/40 bg-status-red/10',
    muted: 'text-muted border-line bg-surface2',
  }[tone];
  return <span className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${cls}`}>{children}</span>;
}

function ActionBtn({ label, onClick, danger, pending }: { label: string; onClick: () => void; danger?: boolean; pending?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`font-mono text-[10px] uppercase tracking-widest border rounded px-2.5 py-1.5 transition-colors disabled:opacity-50 ${
        danger ? 'text-status-red border-status-red/40 hover:bg-status-red/10' : 'text-sonar border-sonar/40 hover:bg-sonar/10'
      }`}
    >
      {label}
    </button>
  );
}

function TenantActions({ t }: { t: AdminTenantRow }) {
  const action = useTenantAction();
  const run = (a: TenantAction) => action.mutate({ id: t.id, action: a });
  return (
    <div className="flex gap-2 justify-end flex-wrap">
      {t.approval === 'PENDING' && <ActionBtn label="Aprovar" onClick={() => run('approve')} pending={action.isPending} />}
      {t.approval === 'PENDING' && <ActionBtn label="Rejeitar" onClick={() => run('reject')} danger pending={action.isPending} />}
      {t.approval === 'APPROVED' && t.status === 'ACTIVE' && <ActionBtn label="Suspender" onClick={() => run('suspend')} danger pending={action.isPending} />}
      {t.status === 'SUSPENDED' && <ActionBtn label="Reativar" onClick={() => run('reactivate')} pending={action.isPending} />}
    </div>
  );
}

function TenantTable({ rows }: { rows: AdminTenantRow[] }) {
  if (rows.length === 0) return <p className="font-sans text-sm text-text-dim px-6 py-4">Nada aqui.</p>;
  return (
    <table className="w-full">
      <thead>
        <tr className="font-mono text-[10px] text-muted uppercase tracking-widest border-b border-line">
          <th className="text-left font-normal px-6 py-2.5">Carteira</th>
          <th className="text-left font-normal px-6 py-2.5">Org</th>
          <th className="text-left font-normal px-6 py-2.5">Aprovação</th>
          <th className="text-left font-normal px-6 py-2.5">Status</th>
          <th className="text-right font-normal px-6 py-2.5">Usuários</th>
          <th className="text-right font-normal px-6 py-2.5">Ações</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((t) => (
          <tr key={t.id} className="border-t border-line/70 hover:bg-sonar/[0.03] transition-colors">
            <td className="px-6 py-3 font-sans text-sm text-text">{t.name}</td>
            <td className="px-6 py-3 font-mono text-xs text-muted tabular-nums">{t.orgCode}</td>
            <td className="px-6 py-3">
              <Badge tone={t.approval === 'APPROVED' ? 'green' : t.approval === 'PENDING' ? 'yellow' : 'red'}>{t.approval}</Badge>
            </td>
            <td className="px-6 py-3">
              <Badge tone={t.status === 'ACTIVE' ? 'green' : 'red'}>{t.status}</Badge>
            </td>
            <td className="px-6 py-3 font-mono text-sm text-text-dim text-right tabular-nums">{t.userCount}</td>
            <td className="px-6 py-3"><TenantActions t={t} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AdminConsolePage() {
  const pending = useAdminTenants('PENDING');
  const all = useAdminTenants();
  const users = useAdminUsers();
  const audit = useAdminAudit();

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="font-mono text-[10px] text-muted uppercase tracking-[0.2em]">Administrador máximo</p>
          <h1 className="font-display text-2xl font-semibold text-text tracking-tight">PACIFIC · Admin</h1>
        </div>
        <span className="font-mono text-[10px] text-muted uppercase tracking-widest">controle global</span>
      </header>

      <section className="panel overflow-hidden">
        <div className="px-6 py-4 border-b border-line flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold text-text tracking-tight">Aprovações pendentes</h2>
          <span className="font-mono text-[10px] text-muted uppercase tracking-widest tabular-nums">{pending.data?.length ?? 0}</span>
        </div>
        {pending.isLoading ? <p className="px-6 py-4 font-mono text-sm text-muted animate-pulse">Carregando…</p> : <TenantTable rows={pending.data ?? []} />}
      </section>

      <section className="panel overflow-hidden">
        <div className="px-6 py-4 border-b border-line"><h2 className="font-display text-lg font-semibold text-text tracking-tight">Todas as carteiras</h2></div>
        {all.isLoading ? <p className="px-6 py-4 font-mono text-sm text-muted animate-pulse">Carregando…</p> : <TenantTable rows={all.data ?? []} />}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel overflow-hidden">
          <div className="px-6 py-4 border-b border-line"><h2 className="font-display text-base font-semibold text-text tracking-tight">Usuários ({users.data?.length ?? 0})</h2></div>
          <ul className="divide-y divide-line/70 max-h-80 overflow-y-auto">
            {(users.data ?? []).map((u) => (
              <li key={u.id} className="px-6 py-2.5 flex items-center justify-between gap-3">
                <span className="font-sans text-sm text-text truncate">{u.email}</span>
                <Badge tone="muted">{u.role}</Badge>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel overflow-hidden">
          <div className="px-6 py-4 border-b border-line"><h2 className="font-display text-base font-semibold text-text tracking-tight">Auditoria</h2></div>
          <ul className="divide-y divide-line/70 max-h-80 overflow-y-auto">
            {(audit.data ?? []).map((a) => (
              <li key={a.id} className="px-6 py-2.5">
                <p className="font-mono text-xs text-text">{a.action} <span className="text-muted">· {a.targetType}</span></p>
                <p className="font-mono text-[10px] text-muted tabular-nums">{a.actorEmail ?? '—'} · {new Date(a.createdAt).toLocaleString('pt-BR')}</p>
              </li>
            ))}
            {(audit.data ?? []).length === 0 && <li className="px-6 py-4 font-sans text-sm text-text-dim">Sem registros.</li>}
          </ul>
        </section>
      </div>
    </main>
  );
}

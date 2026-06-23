'use client';

import Link from 'next/link';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminBadge } from '@/components/admin/ui';
import { useAdminTenants, useAdminEvents } from '@/lib/admin';

interface Item { id: string; tone: 'iris' | 'yellow' | 'red' | 'green'; label: string; detail: string; at?: string; href?: string }

export default function NotificacoesPage() {
  const pending = useAdminTenants('PENDING');
  const events = useAdminEvents();

  const items: Item[] = [];
  for (const t of pending.data ?? []) {
    items.push({ id: `p-${t.id}`, tone: 'yellow', label: 'Conta aguardando aprovação', detail: `${t.name} · ${t.orgCode}`, href: '/admin/aprovacoes' });
  }
  for (const e of events.data ?? []) {
    if (e.type === 'ERROR') items.push({ id: e.id, tone: 'red', label: 'Erro no servidor', detail: e.targetId ?? 'exceção não tratada', at: e.at, href: '/admin/monitoramento' });
    else if (e.type === 'LOGIN_FAILED') items.push({ id: e.id, tone: 'red', label: 'Tentativa de acesso falhou', detail: `${e.actorId ?? e.actorType.toLowerCase()}`, at: e.at, href: '/admin/monitoramento' });
    else if (e.type === 'ACCESS_REVOKED') items.push({ id: e.id, tone: 'red', label: 'Acesso revogado', detail: `devedor ${e.targetId?.slice(0, 8) ?? ''}`, at: e.at, href: '/admin/links' });
    else if (e.type === 'TENANT_SUSPENDED') items.push({ id: e.id, tone: 'red', label: 'Carteira suspensa', detail: e.targetId?.slice(0, 8) ?? '', at: e.at, href: '/admin/seguranca' });
    else if (e.type === 'OPERATION_CREATED') items.push({ id: e.id, tone: 'iris', label: 'Nova operação', detail: `carteira ${e.tenantId?.slice(0, 8) ?? '—'}`, at: e.at });
  }
  // Pendências primeiro; resto por data desc (limita a 30).
  const sorted = items.slice(0, 30);

  return (
    <AdminShell title="Notificações">
      <section className="panel overflow-hidden max-w-3xl">
        <div className="px-6 py-4 border-b border-line flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold text-text tracking-tight">Eventos importantes</h2>
          <span className="font-mono text-[10px] text-muted uppercase tracking-widest tabular-nums">{sorted.length}</span>
        </div>
        <ul className="divide-y divide-line/70">
          {sorted.map((i) => {
            const body = (
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex items-center gap-3">
                  <AdminBadge tone={i.tone}>{i.label}</AdminBadge>
                  <span className="font-sans text-sm text-text-dim truncate">{i.detail}</span>
                </div>
                {i.at && <span className="font-mono text-[10px] text-muted tabular-nums shrink-0">{new Date(i.at).toLocaleString('pt-BR')}</span>}
              </div>
            );
            return (
              <li key={i.id} className="px-6 py-3 hover:bg-iris/[0.03] transition-colors">
                {i.href ? <Link href={i.href}>{body}</Link> : body}
              </li>
            );
          })}
          {sorted.length === 0 && (
            <li className="p-12 text-center">
              <p className="font-mono text-2xl text-muted/60 mb-3" aria-hidden>◎</p>
              <p className="font-sans text-sm text-text-dim">Tudo tranquilo. Sem eventos que exijam atenção.</p>
            </li>
          )}
        </ul>
      </section>
    </AdminShell>
  );
}

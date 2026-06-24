'use client';

import { useState } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminBadge } from '@/components/admin/ui';
import { useAdminAuditFiltered } from '@/lib/admin';

const FILTERS = [
  { v: '', label: 'Tudo' },
  { v: 'tenant', label: 'Carteiras' },
  { v: 'link', label: 'Links' },
  { v: 'user', label: 'Usuários' },
];

export default function AuditoriaPage() {
  const [filter, setFilter] = useState('');
  const audit = useAdminAuditFiltered(filter || undefined);
  const rows = audit.data ?? [];

  return (
    <AdminShell title="Auditoria">
      <div className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.v}
              type="button"
              onClick={() => setFilter(f.v)}
              className={`font-mono text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-colors ${filter === f.v ? 'border-iris/40 bg-iris/10 text-iris' : 'border-line bg-surface2 text-muted hover:text-text'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <section className="panel overflow-hidden">
          <ol className="relative px-6 py-2">
            <span className="absolute left-[27px] top-3 bottom-3 w-px bg-line" aria-hidden />
            {rows.map((a) => (
              <li key={a.id} className="relative flex gap-4 py-2.5">
                <span className="relative z-10 shrink-0 w-4 h-4 mt-0.5 rounded-full border border-line bg-surface2 flex items-center justify-center text-[8px] text-iris" aria-hidden>●</span>
                <div className="min-w-0">
                  <p className="font-mono text-xs text-text">{a.action} <AdminBadge tone="muted">{a.targetType}</AdminBadge></p>
                  <p className="font-mono text-[10px] text-muted tabular-nums">{a.actorEmail ?? '—'} · {new Date(a.createdAt).toLocaleString('pt-BR')} · alvo {a.targetId.slice(0, 8)}…</p>
                </div>
              </li>
            ))}
            {rows.length === 0 && <li className="py-6 text-center font-sans text-sm text-text-dim">{audit.isLoading ? 'Carregando…' : 'Sem registros para este filtro.'}</li>}
          </ol>
        </section>
      </div>
    </AdminShell>
  );
}

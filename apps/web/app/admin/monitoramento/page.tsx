'use client';

import { useState } from 'react';
import type { PlatformEventType } from '@pacific/shared';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminBadge } from '@/components/admin/ui';
import { useAdminEvents } from '@/lib/admin';

const FILTERS: { v?: PlatformEventType; label: string }[] = [
  { v: undefined, label: 'Tudo' },
  { v: 'ERROR', label: 'Erros' },
  { v: 'LOGIN', label: 'Logins' },
  { v: 'LOGIN_FAILED', label: 'Falhas' },
  { v: 'OPERATION_CREATED', label: 'Operações' },
  { v: 'OPERATION_PAID', label: 'Pagamentos' },
  { v: 'LINK_USED', label: 'Uso de links' },
  { v: 'ACCESS_REVOKED', label: 'Revogações' },
];

function tone(t: PlatformEventType): 'iris' | 'green' | 'yellow' | 'red' | 'muted' {
  if (t === 'LOGIN_FAILED' || t === 'ACCESS_REVOKED' || t === 'TENANT_SUSPENDED' || t === 'ERROR') return 'red';
  if (t === 'OPERATION_PAID' || t === 'TENANT_APPROVED' || t === 'ACCESS_REACTIVATED') return 'green';
  if (t === 'LOGIN' || t === 'LINK_USED') return 'iris';
  return 'muted';
}

export default function MonitoramentoPage() {
  const [filter, setFilter] = useState<PlatformEventType | undefined>(undefined);
  const events = useAdminEvents(filter);
  const rows = events.data ?? [];

  return (
    <AdminShell title="Monitoramento">
      <div className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={() => setFilter(f.v)}
              className={`font-mono text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-colors ${filter === f.v ? 'border-iris/40 bg-iris/10 text-iris' : 'border-line bg-surface2 text-muted hover:text-text'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <section className="panel overflow-hidden">
          <div className="px-6 py-4 border-b border-line"><h2 className="font-display text-base font-semibold text-text tracking-tight">Eventos em tempo real</h2></div>
          <ul className="divide-y divide-line/70 max-h-[70vh] overflow-y-auto">
            {rows.map((e) => (
              <li key={e.id} className="px-6 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0 flex items-center gap-3">
                  <AdminBadge tone={tone(e.type)}>{e.type}</AdminBadge>
                  <span className="font-mono text-xs text-muted truncate">
                    {e.actorType.toLowerCase()}{e.actorId ? ` · ${e.actorId.slice(0, 8)}` : ''}{e.targetType ? ` → ${e.targetType}` : ''}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-muted tabular-nums shrink-0">{new Date(e.at).toLocaleString('pt-BR')}</span>
              </li>
            ))}
            {rows.length === 0 && <li className="px-6 py-6 text-center font-sans text-sm text-text-dim">{events.isLoading ? 'Carregando…' : 'Nenhum evento registrado para este filtro.'}</li>}
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}

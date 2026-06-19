'use client';

import { Shell } from '@/components/Shell';
import { useNotifications, useNotificationMutations } from '@/lib/notifications';

export default function NotificacoesPage() {
  const notifs = useNotifications();
  const { generate, markRead } = useNotificationMutations();
  const items = notifs.data?.items ?? [];

  return (
    <Shell title="Notificações">
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] text-muted uppercase tracking-widest">{notifs.data?.total ?? 0} no total</p>
          <button
            type="button"
            onClick={() => void generate.mutateAsync()}
            disabled={generate.isPending}
            className="bg-sonar text-ink font-mono text-xs font-medium uppercase tracking-widest py-2 px-4 rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-sonar disabled:opacity-50"
          >
            {generate.isPending ? 'Gerando…' : 'Gerar alertas de vencimento'}
          </button>
        </div>

        {notifs.isLoading ? (
          <div className="bg-surface border border-line rounded-xl p-10 text-center">
            <p className="font-mono text-sm text-muted animate-pulse">Carregando…</p>
          </div>
        ) : notifs.isError ? (
          <div className="bg-surface border border-status-red/40 rounded-xl p-8" role="alert">
            <p className="font-mono text-sm text-status-red">Não foi possível carregar as notificações.</p>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-surface border border-line rounded-xl p-10 text-center">
            <p className="font-mono text-sm text-muted">Nenhuma notificação. Gere os alertas de vencimento acima.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((n) => (
              <div
                key={n.id}
                className={`bg-surface border rounded-xl p-4 flex items-start justify-between gap-4 ${n.readAt ? 'border-line' : 'border-sonar/30'}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${n.type === 'OVERDUE' ? 'bg-status-red' : 'bg-status-orange'}`} />
                    <p className="font-display text-sm text-text">{n.title}</p>
                  </div>
                  <p className="font-sans text-sm text-muted mt-1">{n.body}</p>
                  <p className="font-mono text-[10px] text-muted mt-1 tabular-nums">{new Date(n.createdAt).toLocaleString('pt-BR')}</p>
                </div>
                {!n.readAt && (
                  <button
                    type="button"
                    onClick={() => void markRead.mutateAsync(n.id)}
                    className="font-mono text-[10px] uppercase tracking-widest text-muted hover:text-sonar shrink-0"
                  >
                    marcar lida
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

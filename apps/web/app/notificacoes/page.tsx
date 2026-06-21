'use client';

import { useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import {
  useNotifications,
  useNotificationMutations,
  ALERT_RULES,
  TYPE_DOT,
  type AlertRuleType,
} from '@/lib/notifications';

const RULES_KEY = 'pacific:alert-rules';
const AUTO_KEY = 'pacific:alert-auto';
const DEFAULT_ENABLED: Record<AlertRuleType, boolean> = {
  DUE_15: true,
  DUE_7: true,
  DUE_3: true,
  DUE_TODAY: true,
  OVERDUE: true,
};

export default function NotificacoesPage() {
  const notifs = useNotifications();
  const { generate, markRead } = useNotificationMutations();
  const items = notifs.data?.items ?? [];

  const [enabled, setEnabled] = useState<Record<AlertRuleType, boolean>>(DEFAULT_ENABLED);
  const [auto, setAuto] = useState(true);

  const activeTypes = (): AlertRuleType[] => ALERT_RULES.filter((r) => enabled[r.type]).map((r) => r.type);

  // Hidrata as preferências do localStorage e, se a automação estiver ligada, gera ao abrir.
  useEffect(() => {
    let nextEnabled = DEFAULT_ENABLED;
    let nextAuto = true;
    try {
      const r = localStorage.getItem(RULES_KEY);
      if (r) nextEnabled = { ...DEFAULT_ENABLED, ...(JSON.parse(r) as Record<string, boolean>) };
      nextAuto = localStorage.getItem(AUTO_KEY) !== '0';
    } catch {
      /* ignora storage indisponível */
    }
    setEnabled(nextEnabled);
    setAuto(nextAuto);
    if (nextAuto) {
      const types = ALERT_RULES.filter((r) => nextEnabled[r.type]).map((r) => r.type);
      void generate.mutateAsync(types);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleRule(type: AlertRuleType): void {
    setEnabled((prev) => {
      const next = { ...prev, [type]: !prev[type] };
      try {
        localStorage.setItem(RULES_KEY, JSON.stringify(next));
      } catch {
        /* ignora */
      }
      return next;
    });
  }

  function toggleAuto(): void {
    setAuto((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(AUTO_KEY, next ? '1' : '0');
      } catch {
        /* ignora */
      }
      return next;
    });
  }

  return (
    <Shell title="Notificações">
      <div className="space-y-6 max-w-3xl">
        {/* Painel de automação */}
        <div className="bg-surface border border-line rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-display text-sm text-text">Automação de alertas</p>
              <p className="font-mono text-[10px] text-muted uppercase tracking-widest mt-0.5">
                {auto ? 'gera ao abrir esta tela' : 'desligada — use “gerar agora”'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={auto}
              onClick={toggleAuto}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-sonar ${auto ? 'bg-sonar' : 'bg-line'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-ink transition-transform ${auto ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ALERT_RULES.map((r) => (
              <button
                key={r.type}
                type="button"
                onClick={() => toggleRule(r.type)}
                aria-pressed={enabled[r.type]}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border font-mono text-[11px] tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-sonar ${
                  enabled[r.type] ? 'border-sonar/40 bg-sonar/5 text-text' : 'border-line text-muted hover:text-text'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${r.dot} ${enabled[r.type] ? '' : 'opacity-30'}`} />
                {r.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-4 pt-1">
            <p className="font-mono text-[10px] text-muted uppercase tracking-widest">{notifs.data?.total ?? 0} no total</p>
            <button
              type="button"
              onClick={() => void generate.mutateAsync(activeTypes())}
              disabled={generate.isPending}
              className="bg-sonar text-ink font-mono text-xs font-medium uppercase tracking-widest py-2 px-4 rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-sonar disabled:opacity-50"
            >
              {generate.isPending ? 'Gerando…' : 'Gerar agora'}
            </button>
          </div>
        </div>

        {/* Lista */}
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
            <p className="font-mono text-sm text-muted">Nenhum alerta. Cadastre operações com vencimento próximo e gere os alertas.</p>
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
                    <span className={`w-2 h-2 rounded-full shrink-0 ${TYPE_DOT[n.type]}`} />
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

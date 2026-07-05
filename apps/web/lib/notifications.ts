'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from './api';

// Réguas de vencimento (configuráveis no painel). DUE_SOON é legado.
export type AlertRuleType = 'DUE_15' | 'DUE_7' | 'DUE_3' | 'DUE_1' | 'DUE_TODAY' | 'OVERDUE';
// Todos os tipos que uma notificação pode ter: réguas + eventos do sobrinho que o padrinho vê.
export type NotificationType =
  | 'DUE_SOON' | AlertRuleType
  | 'LOCATION_DECLINED' | 'LOCATION_STOPPED' | 'LOCATION_SILENT' | 'GEOFENCE_EXIT'
  | 'PAYMENT_CLAIMED' | 'DEBT_SETTLED' | 'DEBTOR_FIRST_ACCESS' | 'WEEKLY_DIGEST'
  | 'DEBTOR_INTENT' | 'DEBTOR_SUPPORT';

export interface NotificationRow {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

// Réguas configuráveis no painel (DUE_SOON é legado e não aparece no painel).
export const ALERT_RULES: { type: AlertRuleType; label: string; dot: string }[] = [
  { type: 'DUE_15', label: '15 dias antes', dot: 'bg-status-green' },
  { type: 'DUE_7', label: '7 dias antes', dot: 'bg-status-yellow' },
  { type: 'DUE_3', label: '3 dias antes', dot: 'bg-status-orange' },
  { type: 'DUE_1', label: '1 dia antes', dot: 'bg-status-orange' },
  { type: 'DUE_TODAY', label: 'No vencimento', dot: 'bg-status-orange' },
  { type: 'OVERDUE', label: 'Após vencer', dot: 'bg-status-red' },
];

// Cor da bolinha por tipo. Exaustivo: se um NotificationType novo for adicionado, o TS acusa aqui.
export const TYPE_DOT: Record<NotificationType, string> = {
  DUE_SOON: 'bg-status-orange',
  DUE_15: 'bg-status-green',
  DUE_7: 'bg-status-yellow',
  DUE_3: 'bg-status-orange',
  DUE_1: 'bg-status-orange',
  DUE_TODAY: 'bg-status-orange',
  OVERDUE: 'bg-status-red',
  // Eventos do sobrinho
  LOCATION_DECLINED: 'bg-status-red',
  LOCATION_STOPPED: 'bg-status-red',
  LOCATION_SILENT: 'bg-status-orange',
  GEOFENCE_EXIT: 'bg-status-orange',
  PAYMENT_CLAIMED: 'bg-status-yellow',
  DEBT_SETTLED: 'bg-status-green',
  DEBTOR_FIRST_ACCESS: 'bg-status-green',
  WEEKLY_DIGEST: 'bg-sonar',
  DEBTOR_INTENT: 'bg-status-green',
  DEBTOR_SUPPORT: 'bg-status-orange',
};

interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiGet<Page<NotificationRow>>('/notifications?limit=100'),
  });
}

export function useNotificationMutations() {
  const qc = useQueryClient();
  const invalidate = (): void => {
    void qc.invalidateQueries({ queryKey: ['notifications'] });
  };
  return {
    generate: useMutation({
      // types ausente = todas as réguas; o painel envia só as ativas.
      mutationFn: (types?: AlertRuleType[]) =>
        apiPost<{ created: number }>('/notifications/generate', types ? { types } : undefined),
      onSuccess: invalidate,
    }),
    markRead: useMutation({
      mutationFn: (id: string) => apiPatch<void>(`/notifications/${id}/read`),
      onSuccess: invalidate,
    }),
  };
}

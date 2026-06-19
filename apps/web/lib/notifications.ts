'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from './api';

export interface NotificationRow {
  id: string;
  type: 'DUE_SOON' | 'OVERDUE';
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}
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
      mutationFn: () => apiPost<{ created: number }>('/notifications/generate'),
      onSuccess: invalidate,
    }),
    markRead: useMutation({
      mutationFn: (id: string) => apiPatch<void>(`/notifications/${id}/read`),
      onSuccess: invalidate,
    }),
  };
}

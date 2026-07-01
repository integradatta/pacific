'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from './api';

export interface MonthlyReportRow {
  month: string; // 'YYYY-MM'
  totalLent: string;
  totalReceivable: string;
  totalReceived: string;
  totalOverdue: string;
  opsActive: number;
  opsSettled: number;
  healthScore: number;
  healthState: string;
  generatedAt: string;
}

export function useReports() {
  return useQuery({ queryKey: ['reports'], queryFn: () => apiGet<MonthlyReportRow[]>('/reports') });
}

export function useGenerateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<MonthlyReportRow>('/reports/generate'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['reports'] }),
  });
}

'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DEFAULT_THRESHOLDS, normalizeThresholds, type DashboardKpis, type PortfolioRow, type PortfolioIntelligence, type IntelligenceThresholds } from '@pacific/shared';
import { apiGet } from './api';

export function useKpis() {
  return useQuery({ queryKey: ['kpis'], queryFn: () => apiGet<DashboardKpis>('/dashboard/kpis') });
}

export function usePortfolio() {
  return useQuery({ queryKey: ['portfolio'], queryFn: () => apiGet<PortfolioRow[]>('/dashboard/portfolio') });
}

export function useIntelligence(t?: IntelligenceThresholds) {
  const qs = t ? `?highRiskBelow=${t.highRiskBelow}&concentrationLimitPct=${t.concentrationLimitPct}&dueSoonDays=${t.dueSoonDays}` : '';
  return useQuery({
    queryKey: ['intelligence', t?.highRiskBelow ?? 0, t?.concentrationLimitPct ?? 0, t?.dueSoonDays ?? 0],
    queryFn: () => apiGet<PortfolioIntelligence>(`/dashboard/intelligence${qs}`),
  });
}

const THRESHOLDS_KEY = 'pacific:intel-thresholds';
/** Limiares de inteligência configuráveis pelo credor, persistidos localmente (sem infra). */
export function useThresholds(): [IntelligenceThresholds, (t: IntelligenceThresholds) => void] {
  const [t, setT] = useState<IntelligenceThresholds>(DEFAULT_THRESHOLDS);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(THRESHOLDS_KEY);
      if (raw) setT(normalizeThresholds(JSON.parse(raw)));
    } catch {
      /* ignora storage inacessível */
    }
  }, []);
  const update = (next: IntelligenceThresholds): void => {
    const n = normalizeThresholds(next);
    setT(n);
    try {
      localStorage.setItem(THRESHOLDS_KEY, JSON.stringify(n));
    } catch {
      /* ignora */
    }
  };
  return [t, update];
}

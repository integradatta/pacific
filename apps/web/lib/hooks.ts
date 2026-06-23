'use client';

import { useQuery } from '@tanstack/react-query';
import type { DashboardKpis, PortfolioRow, PortfolioIntelligence } from '@pacific/shared';
import { apiGet } from './api';

export function useKpis() {
  return useQuery({ queryKey: ['kpis'], queryFn: () => apiGet<DashboardKpis>('/dashboard/kpis') });
}

export function usePortfolio() {
  return useQuery({ queryKey: ['portfolio'], queryFn: () => apiGet<PortfolioRow[]>('/dashboard/portfolio') });
}

export function useIntelligence() {
  return useQuery({ queryKey: ['intelligence'], queryFn: () => apiGet<PortfolioIntelligence>('/dashboard/intelligence') });
}

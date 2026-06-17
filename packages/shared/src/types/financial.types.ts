export type DebtStatus = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

export interface DebtTerms {
  principal: string;   // Decimal string
  rate: string;        // Decimal string (taxa do período)
  ratePeriod: 'MONTHLY' | 'ANNUAL';
  startDate: Date;
  dueDate: Date;
}

export interface Projection { horizonDays: number; balance: string; }

export interface DebtSummary {
  balance: string;
  accruedInterest: string;
  daysRemaining: number;
  status: DebtStatus;
  projections: Projection[];
}

export interface DashboardKpis {
  totalLent: string;        // soma dos principais
  totalReceivable: string;  // soma dos saldos atuais
  totalOverdue: string;     // soma dos saldos vencidos (status RED)
  countByStatus: Record<DebtStatus, number>;
}

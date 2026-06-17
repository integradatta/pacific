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

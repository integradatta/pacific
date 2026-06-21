export type DebtStatus = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

/** Nível de risco interno simples, derivado do score de recuperabilidade. */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface DebtTerms {
  principal: string;   // Decimal string
  rate: string;        // Decimal string (taxa do período)
  ratePeriod: 'MONTHLY' | 'ANNUAL';
  startDate: Date;
  dueDate: Date;
}

export interface Projection { horizonDays: number; balance: string; }

/** Prévia de uma operação ao cadastrar (cálculo em tempo real no cliente). */
export interface OperationPreview {
  finalValue: string;       // valor final no vencimento (principal + juros)
  totalInterest: string;    // juros totais
  profitabilityPct: number; // rentabilidade: juros / principal * 100
  expectedReturn: string;   // retorno esperado (= valor final a receber)
  daysRemaining: number;    // dias até o vencimento
}

/** Scores 0–100. recoverability = potencial de recuperação; temperature = urgência temporal. */
export interface DebtScores { recoverability: number; temperature: number; }

export interface DebtSummary {
  balance: string;
  accruedInterest: string;
  daysRemaining: number;
  status: DebtStatus;
  scores: DebtScores;
  projections: Projection[];
}

export interface DashboardKpis {
  totalLent: string;            // soma dos principais (total investido)
  totalReceivable: string;      // soma dos saldos atuais (valor total da carteira)
  totalOverdue: string;         // soma dos saldos vencidos (status RED)
  totalExpectedReturn: string;  // soma do valor final no vencimento (retorno esperado)
  countActive: number;          // operações não vencidas
  countByStatus: Record<DebtStatus, number>;
  riskDistribution: Record<RiskLevel, number>; // operações por nível de risco
}

export interface PortfolioRow {
  id: string;
  debtorName: string;
  balance: string;
  daysRemaining: number;
  status: DebtStatus;
  recoverability: number;
  temperature: number;
  dueDate: string; // ISO
}

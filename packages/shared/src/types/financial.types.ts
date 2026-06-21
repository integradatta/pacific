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
  balance: string;          // saldo bruto: principal + juros acumulados até a data
  accruedInterest: string;  // só os juros acumulados
  paidAmount: string;       // total já pago (abatimentos registrados)
  amountDue: string;        // devido agora = bruto − pago (piso 0; 0 se quitada)
  settled: boolean;         // operação quitada (paga em total)
  daysRemaining: number;
  status: DebtStatus;
  scores: DebtScores;
  projections: Projection[];
}

export interface DashboardKpis {
  totalLent: string;            // soma dos principais (total investido)
  totalReceivable: string;      // soma do devido agora das operações em aberto (a receber)
  totalOverdue: string;         // soma do devido agora das operações vencidas em aberto
  totalExpectedReturn: string;  // soma do valor final no vencimento (operações em aberto)
  totalReceived: string;        // soma do que já foi pago (abatimentos + quitações)
  countActive: number;          // operações em aberto não vencidas
  countSettled: number;         // operações quitadas (pagas em total)
  countByStatus: Record<DebtStatus, number>; // só operações em aberto
  riskDistribution: Record<RiskLevel, number>; // operações em aberto por nível de risco
}

export interface PortfolioRow {
  id: string;
  debtorName: string;
  principal: string;   // valor original emprestado
  balance: string;     // saldo bruto atual (principal + juros acumulados)
  amountDue: string;   // devido agora (bruto − pago; 0 se quitada)
  paidAmount: string;  // total já pago
  settled: boolean;    // quitada
  daysRemaining: number;
  status: DebtStatus;
  recoverability: number;
  temperature: number;
  dueDate: string; // ISO
  tags: string[];
}

/** Operação completa para a tela de detalhe (dívida + nome do devedor + etiquetas). */
export interface DebtRecord {
  id: string;
  debtorId: string;
  debtorName: string;
  description: string | null;
  principal: string;
  rate: string;
  ratePeriod: 'MONTHLY' | 'ANNUAL';
  currency: string;
  startDate: string; // ISO
  dueDate: string;   // ISO
  status: DebtStatus;
  tags: string[];
  paidAmount: string;        // total já pago
  settledAt: string | null;  // ISO quando quitada; null se em aberto
  createdAt: string; // ISO
}

export type DebtEventKind = 'created' | 'link' | 'login' | 'notification' | 'due' | 'paid';

/** Evento do histórico de uma operação (derivado de dados existentes; sem tabela de eventos). */
export interface DebtEvent {
  at: string; // ISO
  kind: DebtEventKind;
  title: string;
  detail?: string;
}

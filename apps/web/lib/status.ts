import type { DebtStatus } from '@pacific/shared';

export const STATUS_COLOR: Record<DebtStatus, string> = {
  GREEN: 'bg-status-green',
  YELLOW: 'bg-status-yellow',
  ORANGE: 'bg-status-orange',
  RED: 'bg-status-red',
};

export const STATUS_LABEL: Record<DebtStatus, string> = {
  GREEN: 'em dia',
  YELLOW: '≤30d',
  ORANGE: '≤7d',
  RED: 'vencido',
};

export const STATUS_ORDER: DebtStatus[] = ['GREEN', 'YELLOW', 'ORANGE', 'RED'];

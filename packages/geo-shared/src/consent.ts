import { ALLOW, deny, type MemberRole, type RuleResult, type SharingStatus } from './types.js';

// Ações sobre o compartilhamento. Usuário: pause/resume/revoke. Sistema: unavailable/recover.
export type SharingAction = 'pause' | 'resume' | 'revoke' | 'unavailable' | 'recover';

const USER_ACTIONS: ReadonlySet<SharingAction> = new Set(['pause', 'resume', 'revoke']);

// Transições válidas da máquina de estados (spec §1.2).
const TRANSITIONS: Record<SharingAction, { from: SharingStatus[]; to: SharingStatus }> = {
  pause: { from: ['active'], to: 'paused' },
  resume: { from: ['paused'], to: 'active' },
  revoke: { from: ['active', 'paused'], to: 'revoked' },
  unavailable: { from: ['active'], to: 'unavailable' },
  recover: { from: ['unavailable'], to: 'active' },
};

export interface SharingContext {
  role: MemberRole;
  bySystem?: boolean; // ações de sistema (unavailable/recover) não vêm do usuário
}

export interface SharingResult {
  result: RuleResult;
  next?: SharingStatus;
}

/**
 * Calcula o próximo estado de compartilhamento e valida a ação.
 * - supervised_participant NÃO pode pause/revoke (mas pode ir a unavailable pelo sistema).
 * - ações de usuário em transição inválida → 409 (estado incompatível).
 */
export function applySharingAction(current: SharingStatus, action: SharingAction, ctx: SharingContext): SharingResult {
  if (USER_ACTIONS.has(action) && ctx.role === 'supervised_participant') {
    return { result: deny(403, 'Participante supervisionado não pode pausar ou revogar o compartilhamento.') };
  }
  const t = TRANSITIONS[action];
  if (!t.from.includes(current)) {
    return { result: deny(409, `Ação "${action}" inválida a partir do estado "${current}".`) };
  }
  return { result: ALLOW, next: t.to };
}

/** Motivo registrado no consent_log conforme a ação/origem. */
export function consentReason(action: SharingAction): string {
  switch (action) {
    case 'pause':
      return 'paused_by_user';
    case 'resume':
      return 'resumed_by_user';
    case 'revoke':
      return 'revoked_by_user';
    case 'unavailable':
      return 'gps_unavailable';
    case 'recover':
      return 'recovered';
  }
}

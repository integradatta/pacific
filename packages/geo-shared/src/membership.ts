import { ALLOW, deny, type GroupType, type MemberRole, type RuleResult } from './types.js';

// Transições de papel permitidas (spec §1.1). Qualquer transição fora desta lista → 400.
const ALLOWED_TRANSITIONS: ReadonlyArray<{ from: MemberRole; to: MemberRole; supervisedOnly?: boolean }> = [
  { from: 'participant', to: 'admin' },
  { from: 'admin', to: 'participant' },
  { from: 'supervised_participant', to: 'participant' },
  { from: 'participant', to: 'supervised_participant', supervisedOnly: true },
];

/** Valida transição de papel. 400 se não estiver na lista (inclui supervised fora de grupo supervised). */
export function checkRoleTransition(from: MemberRole, to: MemberRole, groupType: GroupType): RuleResult {
  if (from === to) return deny(400, 'Transição de papel inválida: origem e destino iguais.');
  const rule = ALLOWED_TRANSITIONS.find((t) => t.from === from && t.to === to);
  if (!rule) return deny(400, `Transição de papel não permitida: ${from} → ${to}.`);
  if (rule.supervisedOnly && groupType !== 'supervised') {
    return deny(400, 'Ativar supervisão só é permitido em grupos do tipo supervised.');
  }
  return ALLOW;
}

export type AdminAction = 'leave' | 'remove' | 'demote';

/**
 * Regra inviolável: o grupo nunca pode ficar sem administrador. Se o alvo é admin e há apenas
 * 1 admin ativo, bloqueia (409). `activeAdminCount` = total de admins ativos no grupo (incluindo o alvo).
 */
export function checkLastAdmin(action: AdminAction, targetRole: MemberRole, activeAdminCount: number): RuleResult {
  if (targetRole === 'admin' && activeAdminCount <= 1) {
    return deny(
      409,
      'Não é possível realizar esta ação. O grupo precisa de pelo menos um administrador. Promova outro membro a administrador antes de prosseguir.',
    );
  }
  return ALLOW;
}

/** supervised_participant em grupo supervised não pode sair voluntariamente. */
export function canMemberLeave(role: MemberRole, groupType: GroupType): boolean {
  return !(role === 'supervised_participant' && groupType === 'supervised');
}

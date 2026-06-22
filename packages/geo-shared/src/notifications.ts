import type { GroupType, SharingStatus } from './types.js';

/**
 * Mensagem de mudança de status (spec §1.3).
 * - collaborative: genérica, SEM motivo técnico.
 * - supervised: inclui motivo técnico quando indisponível (para o admin saber se é ação do
 *   usuário ou falha técnica).
 */
export function statusChangeMessage(args: {
  groupType: GroupType;
  name: string;
  groupName: string;
  newState: SharingStatus;
}): string {
  const { groupType, name, groupName, newState } = args;
  if (groupType === 'supervised' && newState === 'unavailable') {
    return `${name} — localização indisponível (GPS desligado / sem internet / app fechado pelo sistema).`;
  }
  switch (newState) {
    case 'paused':
      return `${name} pausou o compartilhamento de localização no grupo ${groupName}.`;
    case 'revoked':
      return `${name} encerrou o compartilhamento de localização no grupo ${groupName}.`;
    case 'unavailable':
      return `${name} está com a localização indisponível no grupo ${groupName}.`;
    case 'active':
      return `${name} voltou a compartilhar a localização no grupo ${groupName}.`;
  }
}

/**
 * Consenso unânime para ativar notificações em grupo collaborative (spec §1.3): TODOS os
 * membros ativos precisam ter concordado. Remover um consenso desliga a feature.
 */
export function isConsensusUnanimous(activeMemberIds: readonly string[], agreedMemberIds: Iterable<string>): boolean {
  if (activeMemberIds.length === 0) return false;
  const agreed = new Set(agreedMemberIds);
  return activeMemberIds.every((id) => agreed.has(id));
}

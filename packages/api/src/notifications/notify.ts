import { Prisma } from '@pacific/database';
import type { NotificationType } from '@pacific/database';

type Tx = Prisma.TransactionClient;

/**
 * Cria uma notificação para o padrinho a partir de um evento do sobrinho. Função pura sobre a
 * transação atual (sem injeção → sem ciclos de dependência). Deve rodar dentro de withTenant.
 * - com debtId (ex.: DEBT_SETTLED): upsert por [debtId, type] → não duplica.
 * - sem debtId (nível-devedor): cria uma entrada (eventos discretos; dedup específico fica no chamador).
 */
export async function notifyCreditor(
  tx: Tx,
  input: { tenantId: string; debtorId?: string | null; debtId?: string | null; type: NotificationType; title: string; body: string },
): Promise<void> {
  const { tenantId, debtorId = null, debtId = null, type, title, body } = input;
  if (debtId) {
    await tx.notification.upsert({
      where: { debtId_type: { debtId, type } },
      create: { tenantId, debtorId, debtId, type, title, body },
      update: { title, body, readAt: null, createdAt: new Date() },
    });
    return;
  }
  await tx.notification.create({ data: { tenantId, debtorId, type, title, body } });
}

// Formata valor monetário (string "150.00") em BRL para o corpo das notificações.
export function brl(v: string | number): string {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

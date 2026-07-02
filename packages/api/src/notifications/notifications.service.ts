import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, type Notification } from '@pacific/database';
import { daysRemaining } from '@pacific/shared';
import { TenantScopedService } from '../tenancy/tenant-scoped.service.js';
import type { Page } from '../common/pagination.js';
import { ALERT_TYPES, type AlertType } from './dto/generate-alerts.dto.js';

// Régua de alerta correspondente aos dias até o vencimento (a mais próxima primeiro).
function milestoneFor(days: number): AlertType | null {
  if (days < 0) return 'OVERDUE';
  if (days === 0) return 'DUE_TODAY';
  if (days === 1) return 'DUE_1';
  if (days <= 3) return 'DUE_3';
  if (days <= 7) return 'DUE_7';
  if (days <= 15) return 'DUE_15';
  return null;
}

const ALERT_TITLE: Record<AlertType, string> = {
  DUE_15: 'Vence em 15 dias',
  DUE_7: 'Vence em 7 dias',
  DUE_3: 'Vence em 3 dias',
  DUE_1: 'Vence amanhã',
  DUE_TODAY: 'Vence hoje',
  OVERDUE: 'Dívida vencida',
};

function alertBody(type: AlertType, days: number): string {
  if (type === 'OVERDUE') return `A dívida venceu há ${Math.abs(days)} dia(s).`;
  if (type === 'DUE_TODAY') return 'A dívida vence hoje.';
  if (type === 'DUE_1') return 'A dívida vence amanhã.';
  return `A dívida vence em ${days} dia(s).`;
}

interface DueDebt { id: string; debtorId: string; principal: unknown; rate: unknown; ratePeriod: 'MONTHLY' | 'ANNUAL'; startDate: Date; dueDate: Date }
export interface DueAlertRow { debtorId: string; debtId: string; type: AlertType; title: string; body: string }

/**
 * PURA: mapeia dívidas → linhas de alerta pela régua ativa (sem tocar no banco). Extraída para o
 * caminho set-based (uma INSERT em vez de N upserts) e para testar a lógica de régua isoladamente.
 */
export function dueNotificationRows(debts: DueDebt[], active: ReadonlySet<AlertType>, asOf: Date): DueAlertRow[] {
  const rows: DueAlertRow[] = [];
  for (const d of debts) {
    const days = daysRemaining(
      { principal: String(d.principal), rate: String(d.rate), ratePeriod: d.ratePeriod, startDate: d.startDate, dueDate: d.dueDate },
      asOf,
    );
    const type = milestoneFor(days);
    if (!type || !active.has(type)) continue;
    rows.push({ debtorId: d.debtorId, debtId: d.id, type, title: ALERT_TITLE[type], body: alertBody(type, days) });
  }
  return rows;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly scoped: TenantScopedService) {}

  async list(tenantId: string, page: { limit: number; offset: number }): Promise<Page<Notification>> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const [items, total] = await Promise.all([
        tx.notification.findMany({ where: { tenantId }, take: page.limit, skip: page.offset, orderBy: { createdAt: 'desc' } }),
        tx.notification.count({ where: { tenantId } }),
      ]);
      return { items, total, limit: page.limit, offset: page.offset };
    });
  }

  /**
   * Gera alertas de vencimento pelas réguas (15/7/3/0 dias e atraso). Cada dívida recebe a
   * régua correspondente aos dias até o vencimento. Idempotente por (debtId, type) — alertas
   * distintos acumulam conforme a dívida cruza cada marco. `enabled` filtra as réguas ativas
   * (o painel do credor envia só as ligadas); ausente = todas.
   */
  async generateDueNotifications(
    tenantId: string,
    enabled: readonly AlertType[] = ALERT_TYPES,
    asOf: Date = new Date(),
  ): Promise<{ created: number }> {
    const active = new Set<AlertType>(enabled);
    return this.scoped.withTenant(tenantId, async (tx) => {
      // Só dívidas ABERTAS: quitada não gera "vencida". Sem o settledAt:null, uma dívida paga e
      // vencida ressurgia todo dia (pay() apaga a notificação e o cron recriava).
      const debts = await tx.debt.findMany({ where: { tenantId, deletedAt: null, settledAt: null } });
      const rows = dueNotificationRows(debts, active, asOf);
      if (rows.length === 0) return { created: 0 };
      // SET-BASED: uma única INSERT (era N upserts, um round-trip por dívida). Idempotente por
      // (debtId, type) — reexecuções/duas réplicas apenas atualizam o corpo, sem duplicar.
      const values = rows.map(
        (r) => Prisma.sql`(${randomUUID()}, ${tenantId}, ${r.debtorId}, ${r.debtId}, ${r.type}::"NotificationType", ${r.title}, ${r.body})`,
      );
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "Notification" ("id", "tenantId", "debtorId", "debtId", "type", "title", "body")
        VALUES ${Prisma.join(values)}
        ON CONFLICT ("debtId", "type") DO UPDATE SET "body" = EXCLUDED."body"
      `);
      return { created: rows.length };
    });
  }

  /**
   * Resumo SEMANAL da carteira → uma notificação in-app, só para o padrinho que OPTOU por receber
   * (User.weeklyDigestOptIn). Dedup: no máx. 1 por ~semana (a menos de force=true, p/ teste manual).
   * Conteúdo: vencendo em 7d, vencidas e pagamentos aguardando confirmação.
   */
  async generateWeeklyDigest(tenantId: string, opts: { force?: boolean } = {}, now: Date = new Date()): Promise<{ created: number }> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      // Lock por transação (escopo de tenant): serializa réplicas concorrentes. Sem ele, o dedup
      // check-then-create abaixo duplica o resumo quando 2 instâncias rodam o cron ao mesmo tempo.
      // Funciona sob pgbouncer (transaction mode) por ser xact-scoped; cai no commit.
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${tenantId}), hashtext('weekly_digest'))`);
      const optedIn = await tx.user.findFirst({ where: { tenantId, role: 'CREDITOR', weeklyDigestOptIn: true }, select: { id: true } });
      if (!optedIn) return { created: 0 };
      if (!opts.force) {
        const sixDaysAgo = new Date(now.getTime() - 6 * 86_400_000);
        const recent = await tx.notification.findFirst({ where: { tenantId, type: 'WEEKLY_DIGEST', createdAt: { gte: sixDaysAgo } }, select: { id: true } });
        if (recent) return { created: 0 };
      }
      const in7d = new Date(now.getTime() + 7 * 86_400_000);
      const [dueSoon, overdue, pendingClaims] = await Promise.all([
        tx.debt.count({ where: { tenantId, deletedAt: null, settledAt: null, dueDate: { gte: now, lte: in7d } } }),
        tx.debt.count({ where: { tenantId, deletedAt: null, settledAt: null, dueDate: { lt: now } } }),
        tx.paymentClaim.count({ where: { tenantId, status: 'PENDING' } }),
      ]);
      const parts: string[] = [];
      if (dueSoon > 0) parts.push(`${dueSoon} ajuda${dueSoon > 1 ? 's' : ''} vencendo nos próximos 7 dias`);
      if (overdue > 0) parts.push(`${overdue} vencida${overdue > 1 ? 's' : ''}`);
      if (pendingClaims > 0) parts.push(`${pendingClaims} pagamento${pendingClaims > 1 ? 's' : ''} aguardando sua confirmação`);
      const body = parts.length > 0 ? `Esta semana: ${parts.join(', ')}.` : 'Tudo tranquilo por aqui esta semana — nada vencendo e nada pendente. 👍';
      await tx.notification.create({ data: { tenantId, type: 'WEEKLY_DIGEST', title: 'Resumo semanal', body } });
      return { created: 1 };
    });
  }

  async markRead(tenantId: string, id: string): Promise<Notification> {
    return this.scoped.withTenant(tenantId, async (tx) => {
      const existing = await tx.notification.findFirst({ where: { id, tenantId } });
      if (!existing) throw new NotFoundException('Notificação não encontrada');
      return tx.notification.update({ where: { id }, data: { readAt: new Date() } });
    });
  }
}

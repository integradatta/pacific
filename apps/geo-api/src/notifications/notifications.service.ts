import { Inject, Injectable } from '@nestjs/common';
import { statusChangeMessage, type GroupType, type SharingStatus, type GeofenceEventType } from '@pacific/geo-shared';
import type { Querier } from '../common/geo-db.js';
import { PUSH_SENDER, type PushSender } from './push-sender.js';

interface GroupInfo { group_type: GroupType; name: string; status_notification_enabled: boolean }

@Injectable()
export class NotificationsService {
  constructor(@Inject(PUSH_SENDER) private readonly push: PushSender) {}

  /**
   * Notifica mudança de status (spec §1.3): supervised → admins (sempre); collaborative → demais
   * membros, apenas se a notificação está habilitada (consenso unânime). Executa na transação do
   * caller (Querier), best-effort (não derruba a operação se o push falhar).
   */
  async notifyStatusChange(q: Querier, groupId: string, actorUserId: string, newState: SharingStatus): Promise<void> {
    const group = await this.group(q, groupId);
    if (!group) return;
    let recipients: string[];
    if (group.group_type === 'supervised') {
      recipients = await this.members(q, groupId, 'admin');
    } else {
      if (!group.status_notification_enabled) return; // sem consenso → ninguém
      recipients = (await this.members(q, groupId, 'all')).filter((id) => id !== actorUserId);
    }
    const body = statusChangeMessage({ groupType: group.group_type, name: actorUserId.slice(0, 8), groupName: group.name, newState });
    await this.dispatch(q, recipients, { title: 'Atualização de localização', body });
  }

  /** Alerta de geofence (spec §1.7) → administradores do grupo. */
  async notifyGeofence(q: Querier, groupId: string, actorUserId: string, geofenceName: string, eventType: GeofenceEventType): Promise<void> {
    const admins = await this.members(q, groupId, 'admin');
    const verb = eventType === 'enter' ? 'entrou em' : 'saiu de';
    await this.dispatch(q, admins, { title: 'Alerta de área', body: `${actorUserId.slice(0, 8)} ${verb} "${geofenceName}".` });
  }

  private async dispatch(q: Querier, userIds: string[], message: { title: string; body: string }): Promise<void> {
    if (userIds.length === 0) return;
    const tokens = await q.query<{ push_token: string }>(
      `SELECT push_token FROM geo.user_device WHERE user_id = ANY($1) AND push_token IS NOT NULL AND status = 'active'`,
      [userIds],
    );
    try {
      await this.push.send(tokens.rows.map((r) => r.push_token), message);
    } catch {
      /* best-effort: push não deve derrubar a request */
    }
  }

  private async group(q: Querier, groupId: string): Promise<GroupInfo | null> {
    const r = await q.query<GroupInfo>(`SELECT group_type, name, status_notification_enabled FROM geo."group" WHERE id = $1`, [groupId]);
    return r.rowCount === 0 ? null : r.rows[0]!;
  }
  private async members(q: Querier, groupId: string, mode: 'admin' | 'all'): Promise<string[]> {
    const sql =
      mode === 'admin'
        ? `SELECT user_id FROM geo.group_member WHERE group_id = $1 AND status = 'active' AND role = 'admin'`
        : `SELECT user_id FROM geo.group_member WHERE group_id = $1 AND status = 'active'`;
    const r = await q.query<{ user_id: string }>(sql, [groupId]);
    return r.rows.map((x) => x.user_id);
  }
}

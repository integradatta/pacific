import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { applySharingAction, consentReason, type MemberRole, type SharingStatus, type SharingAction } from '@pacific/geo-shared';
import { GEO_DB, type GeoDb, type Querier } from '../../common/geo-db.js';
import { enforce, type Principal } from '../../common/principal.js';
import { REALTIME, type RealtimePublisher } from '../../realtime/realtime.js';
import { NotificationsService } from '../../notifications/notifications.service.js';

interface MemberRow { id: string; user_id: string; role: MemberRole; sharing_status: SharingStatus; }

@Injectable()
export class SharingService {
  constructor(
    @Inject(GEO_DB) private readonly db: GeoDb,
    @Inject(REALTIME) private readonly realtime: RealtimePublisher,
    private readonly notifications: NotificationsService,
  ) {}

  /** Ação do usuário sobre o próprio compartilhamento (pause/resume/revoke). */
  async setOwnSharing(p: Principal, groupId: string, action: 'pause' | 'resume' | 'revoke'): Promise<{ status: SharingStatus }> {
    return this.db.withTenant(p.tenantId, (q) => this.apply(q, p.tenantId, groupId, p.userId, action, p.userId));
  }

  /** Transição de sistema (unavailable/recover) — usada pelo job de indisponibilidade. */
  async systemTransition(q: Querier, tenantId: string, groupId: string, userId: string, action: 'unavailable' | 'recover'): Promise<{ status: SharingStatus }> {
    return this.apply(q, tenantId, groupId, userId, action, userId, true);
  }

  private async apply(
    q: Querier,
    tenantId: string,
    groupId: string,
    userId: string,
    action: SharingAction,
    by: string,
    bySystem = false,
  ): Promise<{ status: SharingStatus }> {
    const m = await q.query<MemberRow>(
      `SELECT id, user_id, role, sharing_status FROM geo.group_member WHERE group_id = $1 AND user_id = $2 AND status = 'active'`,
      [groupId, userId],
    );
    if (m.rowCount === 0) throw new NotFoundException('Membro não encontrado no grupo');
    const member = m.rows[0]!;
    const { result, next } = applySharingAction(member.sharing_status, action, { role: member.role, bySystem });
    enforce(result);
    const nextState = next!;
    await q.query(`UPDATE geo.group_member SET sharing_status = $1 WHERE id = $2`, [nextState, member.id]);
    await q.query(
      `INSERT INTO geo.consent_log(group_id, user_id, tenant_id, previous_state, new_state, reason, changed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [groupId, userId, tenantId, member.sharing_status, nextState, consentReason(action), by],
    );
    this.realtime.broadcast(groupId, 'status_change', { userId, status: nextState });
    await this.notifications.notifyStatusChange(q, groupId, userId, nextState);
    return { status: nextState };
  }
}

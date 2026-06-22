import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  canMemberLeave,
  checkLastAdmin,
  checkRoleTransition,
  isConsensusUnanimous,
  type GroupType,
  type MemberRole,
} from '@pacific/geo-shared';
import { GEO_DB, type GeoDb, type Querier } from '../../common/geo-db.js';
import { enforce, type Principal } from '../../common/principal.js';
import { REALTIME, type RealtimePublisher } from '../../realtime/realtime.js';

interface GroupRow { id: string; tenant_id: string; group_type: GroupType; name: string; status_notification_enabled: boolean; status_notification_consensus: string[]; }
interface MemberRow { id: string; group_id: string; user_id: string; role: MemberRole; status: string; sharing_status: string; }

@Injectable()
export class GroupsService {
  constructor(
    @Inject(GEO_DB) private readonly db: GeoDb,
    @Inject(REALTIME) private readonly realtime: RealtimePublisher,
  ) {}

  async createGroup(p: Principal, input: { groupType: GroupType; name: string }): Promise<GroupRow> {
    return this.db.withTenant(p.tenantId, async (q) => {
      const notif = input.groupType === 'supervised'; // supervised: sempre on e imutável
      const g = await q.query<GroupRow>(
        `INSERT INTO geo."group"(tenant_id, group_type, name, status_notification_enabled)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [p.tenantId, input.groupType, input.name, notif],
      );
      const group = g.rows[0]!;
      await q.query(
        `INSERT INTO geo.group_member(group_id, user_id, tenant_id, role, sharing_status, status)
         VALUES ($1,$2,$3,'admin','active','active')`,
        [group.id, p.userId, p.tenantId],
      );
      await this.logConsent(q, p.tenantId, group.id, p.userId, null, 'active', p.userId, 'group_created');
      return group;
    });
  }

  async listGroups(p: Principal): Promise<GroupRow[]> {
    return this.db.withTenant(p.tenantId, async (q) => {
      const r = await q.query<GroupRow>(
        `SELECT g.* FROM geo."group" g
         JOIN geo.group_member m ON m.group_id = g.id AND m.user_id = $1 AND m.status = 'active'
         WHERE g.tenant_id = $2 ORDER BY g.created_at DESC`,
        [p.userId, p.tenantId],
      );
      return r.rows;
    });
  }

  async invite(p: Principal, groupId: string, invitedRole: MemberRole): Promise<{ token: string }> {
    return this.db.withTenant(p.tenantId, async (q) => {
      await this.requireAdmin(q, groupId, p.userId);
      const r = await q.query<{ token: string }>(
        `INSERT INTO geo.group_invite(group_id, tenant_id, invited_role, invited_by, expires_at)
         VALUES ($1,$2,$3,$4, now() + interval '48 hours') RETURNING token`,
        [groupId, p.tenantId, invitedRole, p.userId],
      );
      return { token: r.rows[0]!.token };
    });
  }

  async acceptInvite(p: Principal, token: string): Promise<{ groupId: string; role: MemberRole }> {
    return this.db.withTenant(p.tenantId, async (q) => {
      const inv = await q.query<{ group_id: string; invited_role: MemberRole }>(
        `SELECT group_id, invited_role FROM geo.group_invite
         WHERE token = $1 AND tenant_id = $2 AND accepted_at IS NULL AND expires_at > now()`,
        [token, p.tenantId],
      );
      if (inv.rowCount === 0) throw new NotFoundException('Convite inválido, expirado ou já utilizado');
      const { group_id, invited_role } = inv.rows[0]!;
      await q.query(
        `INSERT INTO geo.group_member(group_id, user_id, tenant_id, role, sharing_status, status)
         VALUES ($1,$2,$3,$4,'active','active')
         ON CONFLICT (group_id, user_id) WHERE status = 'active' DO NOTHING`,
        [group_id, p.userId, p.tenantId, invited_role],
      );
      await q.query(`UPDATE geo.group_invite SET accepted_at = now() WHERE token = $1`, [token]);
      await this.logConsent(q, p.tenantId, group_id, p.userId, null, 'active', p.userId, 'invite_accepted');
      this.realtime.broadcast(group_id, 'member_joined', { userId: p.userId, role: invited_role });
      return { groupId: group_id, role: invited_role };
    });
  }

  async changeRole(p: Principal, groupId: string, targetUserId: string, toRole: MemberRole): Promise<void> {
    return this.db.withTenant(p.tenantId, async (q) => {
      const group = await this.requireAdmin(q, groupId, p.userId);
      const target = await this.getActiveMember(q, groupId, targetUserId);
      enforce(checkRoleTransition(target.role, toRole, group.group_type));
      if (target.role === 'admin' && toRole !== 'admin') {
        enforce(checkLastAdmin('demote', target.role, await this.activeAdminCount(q, groupId)));
      }
      await q.query(`UPDATE geo.group_member SET role = $1 WHERE id = $2`, [toRole, target.id]);
    });
  }

  async removeMember(p: Principal, groupId: string, targetUserId: string): Promise<void> {
    return this.db.withTenant(p.tenantId, async (q) => {
      await this.requireAdmin(q, groupId, p.userId);
      const target = await this.getActiveMember(q, groupId, targetUserId);
      enforce(checkLastAdmin('remove', target.role, await this.activeAdminCount(q, groupId)));
      await this.endMembership(q, p.tenantId, groupId, target, p.userId, 'removed', 'removed_by_admin');
    });
  }

  async leave(p: Principal, groupId: string): Promise<void> {
    return this.db.withTenant(p.tenantId, async (q) => {
      const group = await this.getGroup(q, groupId);
      const me = await this.getActiveMember(q, groupId, p.userId);
      if (!canMemberLeave(me.role, group.group_type)) {
        throw new ForbiddenException('Participante supervisionado não pode sair do grupo.');
      }
      enforce(checkLastAdmin('leave', me.role, await this.activeAdminCount(q, groupId)));
      await this.endMembership(q, p.tenantId, groupId, me, p.userId, 'left', 'left_by_user');
    });
  }

  /** Consenso de notificação (collaborative): registra o voto e recalcula a unanimidade. */
  async setNotificationConsensus(p: Principal, groupId: string, agree: boolean): Promise<{ enabled: boolean }> {
    return this.db.withTenant(p.tenantId, async (q) => {
      const group = await this.getGroup(q, groupId);
      if (group.group_type === 'supervised') return { enabled: true }; // imutável
      await this.getActiveMember(q, groupId, p.userId); // garante que é membro
      const agreed = new Set(group.status_notification_consensus ?? []);
      if (agree) agreed.add(p.userId);
      else agreed.delete(p.userId);
      const activeIds = (
        await q.query<{ user_id: string }>(
          `SELECT user_id FROM geo.group_member WHERE group_id = $1 AND status = 'active'`,
          [groupId],
        )
      ).rows.map((r) => r.user_id);
      const enabled = isConsensusUnanimous(activeIds, agreed);
      await q.query(
        `UPDATE geo."group" SET status_notification_enabled = $1, status_notification_consensus = $2::jsonb WHERE id = $3`,
        [enabled, JSON.stringify([...agreed]), groupId],
      );
      return { enabled };
    });
  }

  // ── helpers ──
  private async getGroup(q: Querier, groupId: string): Promise<GroupRow> {
    const r = await q.query<GroupRow>(`SELECT * FROM geo."group" WHERE id = $1`, [groupId]);
    if (r.rowCount === 0) throw new NotFoundException('Grupo não encontrado');
    return r.rows[0]!;
  }
  private async getActiveMember(q: Querier, groupId: string, userId: string): Promise<MemberRow> {
    const r = await q.query<MemberRow>(
      `SELECT * FROM geo.group_member WHERE group_id = $1 AND user_id = $2 AND status = 'active'`,
      [groupId, userId],
    );
    if (r.rowCount === 0) throw new NotFoundException('Membro não encontrado no grupo');
    return r.rows[0]!;
  }
  private async requireAdmin(q: Querier, groupId: string, userId: string): Promise<GroupRow> {
    const group = await this.getGroup(q, groupId);
    const me = await this.getActiveMember(q, groupId, userId);
    if (me.role !== 'admin') throw new ForbiddenException('Apenas administradores do grupo podem fazer isso.');
    return group;
  }
  private async activeAdminCount(q: Querier, groupId: string): Promise<number> {
    const r = await q.query<{ n: string }>(
      `SELECT count(*)::int AS n FROM geo.group_member WHERE group_id = $1 AND role = 'admin' AND status = 'active'`,
      [groupId],
    );
    return Number(r.rows[0]?.n ?? 0);
  }
  private async endMembership(q: Querier, tenantId: string, groupId: string, member: MemberRow, by: string, status: 'removed' | 'left', reason: string): Promise<void> {
    await q.query(
      `UPDATE geo.group_member SET status = $1, left_at = now(), sharing_status = 'revoked' WHERE id = $2`,
      [status, member.id],
    );
    await this.logConsent(q, tenantId, groupId, member.user_id, member.sharing_status, 'revoked', by, reason);
    this.realtime.broadcast(groupId, 'member_left', { userId: member.user_id, reason });
  }
  private async logConsent(q: Querier, tenantId: string, groupId: string, userId: string, prev: string | null, next: string, by: string, reason: string): Promise<void> {
    await q.query(
      `INSERT INTO geo.consent_log(group_id, user_id, tenant_id, previous_state, new_state, reason, changed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [groupId, userId, tenantId, prev, next, reason, by],
    );
  }
}

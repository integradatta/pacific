import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/jwt-auth.guard.js';
import { RateLimitGuard } from '../../common/rate-limit.guard.js';
import { CurrentUser } from '../../common/decorators.js';
import type { Principal } from '../../common/principal.js';
import { GroupsService } from './groups.service.js';
import { CreateGroupDto, InviteDto, ChangeRoleDto, ConsensusDto } from './dto/group.dto.js';

@Controller('api/v1')
@UseGuards(JwtAuthGuard, RateLimitGuard)
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Post('groups')
  create(@CurrentUser() p: Principal, @Body() dto: CreateGroupDto) {
    return this.groups.createGroup(p, dto);
  }

  @Get('groups')
  list(@CurrentUser() p: Principal) {
    return this.groups.listGroups(p);
  }

  @Post('groups/:id/invites')
  invite(@CurrentUser() p: Principal, @Param('id') id: string, @Body() dto: InviteDto) {
    return this.groups.invite(p, id, dto.invitedRole);
  }

  @Post('invites/:token/accept')
  accept(@CurrentUser() p: Principal, @Param('token') token: string) {
    return this.groups.acceptInvite(p, token);
  }

  @Put('groups/:id/members/:userId/role')
  changeRole(@CurrentUser() p: Principal, @Param('id') id: string, @Param('userId') userId: string, @Body() dto: ChangeRoleDto) {
    return this.groups.changeRole(p, id, userId, dto.role);
  }

  @Delete('groups/:id/members/:userId')
  remove(@CurrentUser() p: Principal, @Param('id') id: string, @Param('userId') userId: string) {
    return this.groups.removeMember(p, id, userId);
  }

  @Post('groups/:id/leave')
  leave(@CurrentUser() p: Principal, @Param('id') id: string) {
    return this.groups.leave(p, id);
  }

  @Post('groups/:id/notification-consensus')
  consensus(@CurrentUser() p: Principal, @Param('id') id: string, @Body() dto: ConsensusDto) {
    return this.groups.setNotificationConsensus(p, id, dto.agree);
  }
}

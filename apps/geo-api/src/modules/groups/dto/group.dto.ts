import { IsBoolean, IsIn, IsString, MinLength } from 'class-validator';
import type { GroupType, MemberRole } from '@pacific/geo-shared';

const ROLES: MemberRole[] = ['admin', 'participant', 'supervised_participant'];

export class CreateGroupDto {
  @IsIn(['supervised', 'collaborative']) groupType!: GroupType;
  @IsString() @MinLength(1) name!: string;
}

export class InviteDto {
  @IsIn(ROLES) invitedRole!: MemberRole;
}

export class ChangeRoleDto {
  @IsIn(ROLES) role!: MemberRole;
}

export class ConsensusDto {
  @IsBoolean() agree!: boolean;
}

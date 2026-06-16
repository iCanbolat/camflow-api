import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RequirePermission } from '../common/decorators';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { MembersService } from './members.service';
import {
  InviteMemberDto,
  SetMemberRoleDto,
  UpdateMemberDto,
} from './organization.dto';
import { Permission } from './permissions';

@Controller('organizations/:orgId/members')
@UseGuards(OrgScopeGuard, PermissionsGuard)
export class MembersController {
  constructor(private readonly members: MembersService) {}

  // Any active member can see the roster.
  @Get()
  list(@Param('orgId', ParseUUIDPipe) orgId: string) {
    return this.members.list(orgId);
  }

  @Post()
  @RequirePermission(Permission.ManageTeam)
  invite(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.members.invite(orgId, dto);
  }

  @Patch(':memberId')
  @RequirePermission(Permission.ManageTeam)
  update(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.members.update(orgId, memberId, dto);
  }

  @Patch(':memberId/role')
  @RequirePermission(Permission.ChangeRoles)
  setRole(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: SetMemberRoleDto,
  ) {
    return this.members.setRole(orgId, memberId, dto);
  }

  @Delete(':memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(Permission.ManageTeam)
  remove(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.members.remove(orgId, memberId);
  }
}

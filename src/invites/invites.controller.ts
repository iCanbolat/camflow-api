import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentUser,
  Public,
  RequirePermission,
  type AuthUser,
} from '../common/decorators';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../organizations/permissions';
import { InvitesService } from './invites.service';

@Controller()
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  /** Issue (or re-fetch) a member's invite link. Org-scoped, team managers. */
  @Post('organizations/:orgId/members/:memberId/invite')
  @UseGuards(OrgScopeGuard, PermissionsGuard)
  @RequirePermission(Permission.ManageTeam)
  issue(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.invites.issue(orgId, memberId);
  }

  /** What the invitee sees before accepting. Public (code is the secret). */
  @Public()
  @Get('invites/:code')
  preview(@Param('code') code: string) {
    return this.invites.preview(code);
  }

  /** Redeem a code: links the signed-in account to the invited member. */
  @Post('invites/:code/redeem')
  @HttpCode(HttpStatus.OK)
  redeem(@Param('code') code: string, @CurrentUser() user: AuthUser) {
    return this.invites.redeem(code, user.id);
  }
}

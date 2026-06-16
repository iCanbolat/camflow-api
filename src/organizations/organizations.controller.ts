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
import {
  CurrentUser,
  RequirePermission,
  type AuthUser,
} from '../common/decorators';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import {
  CreateOrganizationDto,
  SetPlanDto,
  SetStorageAddOnDto,
  UpdateOrganizationDto,
} from './organization.dto';
import { OrganizationsService } from './organizations.service';
import { Permission } from './permissions';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrganizationDto) {
    return this.orgs.create(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.orgs.listForAccount(user.id);
  }

  // --- Org-scoped (membership required) ---

  @Get(':orgId')
  @UseGuards(OrgScopeGuard)
  get(@Param('orgId', ParseUUIDPipe) orgId: string) {
    return this.orgs.get(orgId);
  }

  @Patch(':orgId')
  @UseGuards(OrgScopeGuard, PermissionsGuard)
  @RequirePermission(Permission.EditCompanyProfile)
  update(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.orgs.update(orgId, dto);
  }

  @Post(':orgId/plan')
  @UseGuards(OrgScopeGuard, PermissionsGuard)
  @RequirePermission(Permission.ManageBilling)
  setPlan(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: SetPlanDto,
  ) {
    return this.orgs.setPlan(orgId, dto);
  }

  @Post(':orgId/subscribe')
  @UseGuards(OrgScopeGuard, PermissionsGuard)
  @RequirePermission(Permission.ManageBilling)
  subscribe(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: SetPlanDto,
  ) {
    return this.orgs.subscribe(orgId, dto);
  }

  @Post(':orgId/storage-add-on')
  @UseGuards(OrgScopeGuard, PermissionsGuard)
  @RequirePermission(Permission.ManageBilling)
  setStorageAddOn(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: SetStorageAddOnDto,
  ) {
    return this.orgs.setStorageAddOn(orgId, dto);
  }

  @Delete(':orgId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OrgScopeGuard, PermissionsGuard)
  @RequirePermission(Permission.DeleteOrganization)
  remove(@Param('orgId', ParseUUIDPipe) orgId: string) {
    return this.orgs.softDelete(orgId);
  }
}

import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Permission } from '../organizations/permissions';

/** Routes marked `@Public()` skip the global JWT auth guard. */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Permissions required by an org-scoped route (checked by PermissionsGuard). */
export const PERMISSIONS_KEY = 'permissions';
export const RequirePermission = (...perms: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, perms);

/** The authenticated account, attached by JwtStrategy. */
export interface AuthUser {
  id: string;
  email: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

/** The caller's membership row in the scoped org, attached by OrgScopeGuard. */
export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.membership;
  },
);

/** The scoped organization id (route `:orgId`), attached by OrgScopeGuard. */
export const CurrentOrgId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.organizationId;
  },
);

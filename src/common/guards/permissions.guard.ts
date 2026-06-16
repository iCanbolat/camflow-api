import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators';
import { can, Permission, Role } from '../../organizations/permissions';

/**
 * Enforces `@RequirePermission(...)` against the caller's role in the scoped
 * org. Must run after OrgScopeGuard (which attaches `request.membership`).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const membership = request.membership as { role: Role } | undefined;
    if (!membership) throw new ForbiddenException('No membership in scope.');

    const allowed = required.every((perm) => can(membership.role, perm));
    if (!allowed) {
      throw new ForbiddenException('Your role lacks the required permission.');
    }
    return true;
  }
}

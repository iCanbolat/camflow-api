import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { orgMembers, organizations } from '../../database/schema';

/**
 * Resolves the org from the `:orgId` route param, loads the caller's active
 * membership, and attaches `{ membership, organizationId, organization }` to the
 * request. Rejects callers who aren't members of the org. Run after the global
 * JwtAuthGuard (so `request.user` is present).
 */
@Injectable()
export class OrgScopeGuard implements CanActivate {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as { id: string } | undefined;
    const orgId: string | undefined = request.params?.orgId;

    if (!user) throw new ForbiddenException('Not authenticated.');
    if (!orgId) throw new ForbiddenException('Missing organization id.');

    const org = await this.db.query.organizations.findFirst({
      where: and(eq(organizations.id, orgId), isNull(organizations.deletedAt)),
    });
    if (!org) {
      throw new ForbiddenException({
        code: 'organizationUnavailable',
        message: 'Organization not found.',
      });
    }

    const membership = await this.db.query.orgMembers.findFirst({
      where: and(
        eq(orgMembers.organizationId, orgId),
        eq(orgMembers.accountId, user.id),
        isNull(orgMembers.deletedAt),
      ),
    });
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenException('You are not a member of this organization.');
    }

    request.organization = org;
    request.organizationId = orgId;
    request.membership = membership;
    return true;
  }
}

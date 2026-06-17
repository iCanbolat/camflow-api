import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, isNull } from 'drizzle-orm';
import { toOrganizationDto } from '../common/mappers';
import { DRIZZLE, type Database } from '../database/database.module';
import { nextRowVersion, orgMembers, organizations } from '../database/schema';
import { roleDisplayName } from '../organizations/permissions';
import {
  buildInviteLink,
  generateCode,
  InviteLink,
  normalizeCode,
} from './invite-codes';

@Injectable()
export class InvitesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly config: ConfigService,
  ) {}

  /** Idempotent: returns the member's existing code or issues a fresh one. */
  async issue(orgId: string, memberId: string): Promise<InviteLink> {
    const member = await this.db.query.orgMembers.findFirst({
      where: and(
        eq(orgMembers.id, memberId),
        eq(orgMembers.organizationId, orgId),
        isNull(orgMembers.deletedAt),
      ),
    });
    if (!member) throw new NotFoundException('Member not found.');
    if (member.inviteCode) return this.link(member.inviteCode);

    let code = generateCode();
    while (await this.findByCode(code)) code = generateCode();

    await this.db
      .update(orgMembers)
      .set({
        inviteCode: code,
        inviteCreatedAt: new Date(),
        updatedAt: new Date(),
        rowVersion: nextRowVersion(),
      })
      .where(eq(orgMembers.id, memberId));
    return this.link(code);
  }

  async preview(rawCode: string) {
    const member = await this.liveMemberByCode(rawCode);
    const org = await this.liveOrg(member.organizationId);
    return {
      organizationName: org.name,
      organizationLogoFileName: org.logoFileName,
      memberName: member.name,
      roleDisplayName: roleDisplayName(member.role),
    };
  }

  /** Links the account to the invited member row and returns the joined org. */
  async redeem(rawCode: string, accountId: string) {
    const member = await this.liveMemberByCode(rawCode);
    const org = await this.liveOrg(member.organizationId);

    // Idempotent: re-opening your own redeemed invite just succeeds.
    if (member.accountId === accountId) {
      if (member.status !== 'active') await this.activate(member.id, accountId);
      return toOrganizationDto(org);
    }

    if (member.accountId) {
      throw new ConflictException({
        code: 'alreadyRedeemed',
        message: 'This invite has already been used by someone else.',
      });
    }

    const existing = await this.db.query.orgMembers.findFirst({
      where: and(
        eq(orgMembers.organizationId, org.id),
        eq(orgMembers.accountId, accountId),
        isNull(orgMembers.deletedAt),
      ),
    });
    if (existing) {
      throw new ConflictException({
        code: 'alreadyMember',
        organizationId: org.id,
        organizationName: org.name,
        message: "You're already a member of this organization.",
      });
    }

    await this.activate(member.id, accountId);
    return toOrganizationDto(org);
  }

  private async activate(memberId: string, accountId: string) {
    await this.db
      .update(orgMembers)
      .set({
        accountId,
        status: 'active',
        updatedAt: new Date(),
        rowVersion: nextRowVersion(),
      })
      .where(eq(orgMembers.id, memberId));
  }

  private link(code: string): InviteLink {
    return buildInviteLink(
      code,
      this.config.get<string>('INVITE_WEB_HOST', 'camflow.app'),
      this.config.get<string>('INVITE_SCHEME', 'camflow'),
    );
  }

  private findByCode(code: string) {
    return this.db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.inviteCode, code), isNull(orgMembers.deletedAt)),
    });
  }

  private async liveMemberByCode(rawCode: string) {
    const code = normalizeCode(rawCode);
    const member = code ? await this.findByCode(code) : undefined;
    if (!member) {
      throw new NotFoundException({
        code: 'codeNotFound',
        message: "This invite code isn't valid. Ask your team for a new link.",
      });
    }
    return member;
  }

  private async liveOrg(orgId: string) {
    const org = await this.db.query.organizations.findFirst({
      where: and(eq(organizations.id, orgId), isNull(organizations.deletedAt)),
    });
    if (!org) {
      throw new NotFoundException({
        code: 'organizationUnavailable',
        message: 'The organization for this invite is no longer available.',
      });
    }
    return org;
  }
}

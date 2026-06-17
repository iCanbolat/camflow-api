import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { toMemberDto } from '../common/mappers';
import { DRIZZLE, type Database } from '../database/database.module';
import { nextRowVersion, orgMembers, projectMembers } from '../database/schema';
import { pickColor } from '../auth/auth.util';
import {
  InviteMemberDto,
  SetMemberRoleDto,
  UpdateMemberDto,
} from './organization.dto';

@Injectable()
export class MembersService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(orgId: string) {
    const rows = await this.db.query.orgMembers.findMany({
      where: and(
        eq(orgMembers.organizationId, orgId),
        isNull(orgMembers.deletedAt),
      ),
    });
    return rows.map(toMemberDto);
  }

  /** Invites a person (status 'invited'); they redeem an invite link later. */
  async invite(orgId: string, dto: InviteMemberDto) {
    const member = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(orgMembers)
        .values({
          id: dto.id,
          organizationId: orgId,
          name: dto.name,
          phoneNumber: dto.phoneNumber ?? '',
          title: dto.title ?? '',
          role: dto.role ?? 'member',
          status: 'invited',
          colorHex: pickColor(dto.name + orgId),
        })
        .returning();

      if (dto.projectIds?.length) {
        await tx
          .insert(projectMembers)
          .values(
            dto.projectIds.map((projectId) => ({
              projectId,
              memberId: row.id,
            })),
          )
          .onConflictDoNothing();
      }
      return row;
    });
    return toMemberDto(member);
  }

  async update(orgId: string, memberId: string, dto: UpdateMemberDto) {
    await this.requireMember(orgId, memberId);
    const [row] = await this.db
      .update(orgMembers)
      .set({
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.phoneNumber !== undefined && { phoneNumber: dto.phoneNumber }),
        ...(dto.title !== undefined && { title: dto.title }),
        updatedAt: new Date(),
        rowVersion: nextRowVersion(),
      })
      .where(eq(orgMembers.id, memberId))
      .returning();
    return toMemberDto(row);
  }

  async setRole(orgId: string, memberId: string, dto: SetMemberRoleDto) {
    const member = await this.requireMember(orgId, memberId);
    if (member.role === 'owner') {
      throw new ForbiddenException("The owner's role cannot be changed.");
    }
    const [row] = await this.db
      .update(orgMembers)
      .set({
        role: dto.role,
        updatedAt: new Date(),
        rowVersion: nextRowVersion(),
      })
      .where(eq(orgMembers.id, memberId))
      .returning();
    return toMemberDto(row);
  }

  async remove(orgId: string, memberId: string) {
    const member = await this.requireMember(orgId, memberId);
    if (member.role === 'owner') {
      throw new ForbiddenException('The owner cannot be removed.');
    }
    await this.db.transaction(async (tx) => {
      await tx
        .update(orgMembers)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
          rowVersion: nextRowVersion(),
        })
        .where(eq(orgMembers.id, memberId));
      await tx
        .delete(projectMembers)
        .where(eq(projectMembers.memberId, memberId));
    });
  }

  private async requireMember(orgId: string, memberId: string) {
    const member = await this.db.query.orgMembers.findFirst({
      where: and(
        eq(orgMembers.id, memberId),
        eq(orgMembers.organizationId, orgId),
        isNull(orgMembers.deletedAt),
      ),
    });
    if (!member) throw new NotFoundException('Member not found.');
    return member;
  }
}

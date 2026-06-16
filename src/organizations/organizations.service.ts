import {
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { toOrganizationDto } from '../common/mappers';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  accounts,
  nextRowVersion,
  orgMembers,
  organizations,
} from '../database/schema';
import {
  CreateOrganizationDto,
  SetPlanDto,
  SetStorageAddOnDto,
  UpdateOrganizationDto,
} from './organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Creates an org and inserts its creator as the active owner member. */
  async create(accountId: string, dto: CreateOrganizationDto) {
    return this.db.transaction(async (tx) => {
      const account = await tx.query.accounts.findFirst({
        where: and(eq(accounts.id, accountId), isNull(accounts.deletedAt)),
      });
      if (!account) throw new UnauthorizedException('Account unavailable.');

      const [org] = await tx
        .insert(organizations)
        .values({
          id: dto.id,
          name: dto.name,
          phone: dto.phone ?? '',
          email: dto.email ?? '',
          website: dto.website ?? '',
          ownerAccountId: accountId,
          trialStartedAt: new Date(),
        })
        .returning();

      await tx.insert(orgMembers).values({
        organizationId: org.id,
        accountId,
        name: account.displayName,
        role: 'owner',
        status: 'active',
        colorHex: account.colorHex,
      });

      return toOrganizationDto(org);
    });
  }

  /** Orgs the account is an active member of. */
  async listForAccount(accountId: string) {
    const rows = await this.db
      .select({ org: organizations })
      .from(orgMembers)
      .innerJoin(organizations, eq(orgMembers.organizationId, organizations.id))
      .where(
        and(
          eq(orgMembers.accountId, accountId),
          isNull(orgMembers.deletedAt),
          isNull(organizations.deletedAt),
        ),
      );
    return rows.map((r) => toOrganizationDto(r.org));
  }

  async get(orgId: string) {
    const org = await this.load(orgId);
    return toOrganizationDto(org);
  }

  async update(orgId: string, dto: UpdateOrganizationDto) {
    const [org] = await this.db
      .update(organizations)
      .set({
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.logoFileName !== undefined && {
          logoFileName: dto.logoFileName,
        }),
        updatedAt: new Date(),
        rowVersion: nextRowVersion(),
      })
      .where(and(eq(organizations.id, orgId), isNull(organizations.deletedAt)))
      .returning();
    if (!org) throw new NotFoundException('Organization not found.');
    return toOrganizationDto(org);
  }

  async setPlan(orgId: string, dto: SetPlanDto) {
    const [org] = await this.db
      .update(organizations)
      .set({
        planTier: dto.planTier,
        updatedAt: new Date(),
        rowVersion: nextRowVersion(),
      })
      .where(and(eq(organizations.id, orgId), isNull(organizations.deletedAt)))
      .returning();
    if (!org) throw new NotFoundException('Organization not found.');
    return toOrganizationDto(org);
  }

  /** Subscribes to a paid plan; stamps `subscriptionStartedAt` once. */
  async subscribe(orgId: string, dto: SetPlanDto) {
    const org = await this.load(orgId);
    const [updated] = await this.db
      .update(organizations)
      .set({
        planTier: dto.planTier,
        subscriptionStartedAt: org.subscriptionStartedAt ?? new Date(),
        updatedAt: new Date(),
        rowVersion: nextRowVersion(),
      })
      .where(eq(organizations.id, orgId))
      .returning();
    return toOrganizationDto(updated);
  }

  async setStorageAddOn(orgId: string, dto: SetStorageAddOnDto) {
    const [org] = await this.db
      .update(organizations)
      .set({
        storageAddOn: dto.storageAddOn,
        updatedAt: new Date(),
        rowVersion: nextRowVersion(),
      })
      .where(and(eq(organizations.id, orgId), isNull(organizations.deletedAt)))
      .returning();
    if (!org) throw new NotFoundException('Organization not found.');
    return toOrganizationDto(org);
  }

  /** Soft-deletes the org (owner only — gated by `deleteOrganization`). */
  async softDelete(orgId: string) {
    await this.db
      .update(organizations)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
        rowVersion: nextRowVersion(),
      })
      .where(and(eq(organizations.id, orgId), isNull(organizations.deletedAt)));
  }

  private async load(orgId: string) {
    const org = await this.db.query.organizations.findFirst({
      where: and(eq(organizations.id, orgId), isNull(organizations.deletedAt)),
    });
    if (!org) throw new NotFoundException('Organization not found.');
    return org;
  }
}

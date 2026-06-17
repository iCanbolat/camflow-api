import { accounts, orgMembers, organizations } from '../database/schema';
import {
  effectivePlan,
  effectiveStorageBytes,
  subscriptionStatus,
  trialDaysRemaining,
  trialEndsAt,
} from '../organizations/plan';
import { roleDisplayName } from '../organizations/permissions';

type AccountRow = typeof accounts.$inferSelect;
type OrganizationRow = typeof organizations.$inferSelect;
type OrgMemberRow = typeof orgMembers.$inferSelect;

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/**
 * DTO mappers convert Drizzle rows into the JSON shape the iOS client maps onto
 * its SwiftData models. Server-sourced rows are always `syncStatus: 'synced'`.
 */
export function toAccountDto(a: AccountRow) {
  return {
    id: a.id,
    email: a.email,
    displayName: a.displayName,
    provider: a.provider,
    colorHex: a.colorHex,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    deletedAt: iso(a.deletedAt),
    syncStatus: 'synced' as const,
  };
}

export function toOrganizationDto(o: OrganizationRow) {
  const billing = {
    planTier: o.planTier,
    trialStartedAt: o.trialStartedAt,
    subscriptionStartedAt: o.subscriptionStartedAt,
    storageAddOn: o.storageAddOn,
  };
  return {
    id: o.id,
    name: o.name,
    logoFileName: o.logoFileName,
    phone: o.phone,
    email: o.email,
    website: o.website,
    ownerAccountId: o.ownerAccountId,
    planTier: o.planTier,
    storageAddOn: o.storageAddOn,
    trialStartedAt: iso(o.trialStartedAt),
    trialEndsAt: iso(trialEndsAt(billing)),
    subscriptionStartedAt: iso(o.subscriptionStartedAt),
    // Derived entitlement fields (mirror iOS Organization computed props).
    subscriptionStatus: subscriptionStatus(billing),
    effectivePlan: effectivePlan(billing),
    trialDaysRemaining: trialDaysRemaining(billing),
    effectiveStorageBytes: effectiveStorageBytes(billing),
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    deletedAt: iso(o.deletedAt),
    syncStatus: 'synced' as const,
  };
}

export function toMemberDto(m: OrgMemberRow) {
  return {
    id: m.id,
    organizationId: m.organizationId,
    accountId: m.accountId,
    name: m.name,
    phoneNumber: m.phoneNumber,
    title: m.title,
    role: m.role,
    roleDisplayName: roleDisplayName(m.role),
    status: m.status,
    colorHex: m.colorHex,
    inviteCode: m.inviteCode,
    inviteCreatedAt: iso(m.inviteCreatedAt),
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    deletedAt: iso(m.deletedAt),
    syncStatus: 'synced' as const,
  };
}

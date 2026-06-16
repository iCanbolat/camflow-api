/**
 * Plan/trial/subscription derivations, ported from iOS `PlanTier.swift` and
 * `Organization` computed properties. Storage limits are display-only.
 */
export type PlanTier = 'basic' | 'pro' | 'premium';
export type StorageAddOn = 'none' | 'plus50' | 'plus250' | 'plus1tb';
export type SubscriptionStatus = 'trialing' | 'active' | 'expired';

export const TRIAL_LENGTH_MS = 7 * 24 * 60 * 60 * 1000;

const PLAN_MAX_PROJECTS: Record<PlanTier, number | null> = {
  basic: 1,
  pro: 5,
  premium: null,
};
const PLAN_MAX_MEMBERS: Record<PlanTier, number | null> = {
  basic: 3,
  pro: 10,
  premium: 25,
};
const PLAN_STORAGE_BYTES: Record<PlanTier, number> = {
  basic: 5_000_000_000,
  pro: 50_000_000_000,
  premium: 150_000_000_000,
};
const ADD_ON_BYTES: Record<StorageAddOn, number> = {
  none: 0,
  plus50: 50_000_000_000,
  plus250: 250_000_000_000,
  plus1tb: 1_000_000_000_000,
};

export interface OrgBilling {
  planTier: PlanTier;
  trialStartedAt: Date | null;
  subscriptionStartedAt: Date | null;
  storageAddOn: StorageAddOn;
}

export function trialEndsAt(org: OrgBilling): Date | null {
  return org.trialStartedAt
    ? new Date(org.trialStartedAt.getTime() + TRIAL_LENGTH_MS)
    : null;
}

export function subscriptionStatus(org: OrgBilling): SubscriptionStatus {
  if (org.subscriptionStartedAt) return 'active';
  const end = trialEndsAt(org);
  // No trial start (legacy/grandfathered) → treat as active, never locked out.
  if (!end) return 'active';
  return Date.now() < end.getTime() ? 'trialing' : 'expired';
}

/** Trial grants full (Premium) access; otherwise the chosen plan applies. */
export function effectivePlan(org: OrgBilling): PlanTier {
  return subscriptionStatus(org) === 'trialing' ? 'premium' : org.planTier;
}

export function trialDaysRemaining(org: OrgBilling): number {
  const end = trialEndsAt(org);
  if (!end || Date.now() >= end.getTime()) return 0;
  return Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export function maxActiveProjects(plan: PlanTier): number | null {
  return PLAN_MAX_PROJECTS[plan];
}

export function maxMembers(plan: PlanTier): number | null {
  return PLAN_MAX_MEMBERS[plan];
}

export function effectiveStorageBytes(org: OrgBilling): number {
  return PLAN_STORAGE_BYTES[effectivePlan(org)] + ADD_ON_BYTES[org.storageAddOn];
}

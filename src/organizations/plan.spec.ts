import {
  effectivePlan,
  effectiveStorageBytes,
  OrgBilling,
  subscriptionStatus,
  trialDaysRemaining,
} from './plan';

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

describe('plan / trial / subscription', () => {
  it('a fresh trial is trialing with Premium entitlement', () => {
    const org: OrgBilling = {
      planTier: 'basic',
      trialStartedAt: daysAgo(1),
      subscriptionStartedAt: null,
      storageAddOn: 'none',
    };
    expect(subscriptionStatus(org)).toBe('trialing');
    expect(effectivePlan(org)).toBe('premium');
    expect(trialDaysRemaining(org)).toBeGreaterThan(0);
  });

  it('an expired trial with no subscription is expired and uses its plan', () => {
    const org: OrgBilling = {
      planTier: 'basic',
      trialStartedAt: daysAgo(10),
      subscriptionStartedAt: null,
      storageAddOn: 'none',
    };
    expect(subscriptionStatus(org)).toBe('expired');
    expect(effectivePlan(org)).toBe('basic');
    expect(trialDaysRemaining(org)).toBe(0);
  });

  it('a subscribed org is active on its chosen plan', () => {
    const org: OrgBilling = {
      planTier: 'pro',
      trialStartedAt: daysAgo(30),
      subscriptionStartedAt: daysAgo(2),
      storageAddOn: 'none',
    };
    expect(subscriptionStatus(org)).toBe('active');
    expect(effectivePlan(org)).toBe('pro');
  });

  it('legacy rows with no trial start are grandfathered active', () => {
    const org: OrgBilling = {
      planTier: 'basic',
      trialStartedAt: null,
      subscriptionStartedAt: null,
      storageAddOn: 'none',
    };
    expect(subscriptionStatus(org)).toBe('active');
  });

  it('add-on stacks on the effective plan storage', () => {
    const org: OrgBilling = {
      planTier: 'pro',
      trialStartedAt: daysAgo(30),
      subscriptionStartedAt: daysAgo(1),
      storageAddOn: 'plus250',
    };
    // pro base 50GB + 250GB add-on
    expect(effectiveStorageBytes(org)).toBe(50_000_000_000 + 250_000_000_000);
  });
});

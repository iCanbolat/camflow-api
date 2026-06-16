import { pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { accounts } from './accounts';
import { idCol, softDeleteCol, syncCols, timestamps } from './_helpers';

export const planTier = pgEnum('plan_tier', ['basic', 'pro', 'premium']);
export const storageAddOn = pgEnum('storage_add_on', [
  'none',
  'plus50',
  'plus250',
  'plus1tb',
]);

/**
 * A company/organization tenant. Mirrors the iOS `Organization` model. Trial &
 * subscription status are derived from `trialStartedAt` / `subscriptionStartedAt`
 * (see organizations.service). Storage limits are display-only.
 */
export const organizations = pgTable('organizations', {
  id: idCol(),
  name: varchar('name', { length: 200 }).notNull(),
  logoFileName: varchar('logo_file_name', { length: 255 }),
  phone: varchar('phone', { length: 64 }).notNull().default(''),
  email: varchar('email', { length: 320 }).notNull().default(''),
  website: varchar('website', { length: 512 }).notNull().default(''),
  ownerAccountId: uuid('owner_account_id')
    .notNull()
    .references(() => accounts.id),
  planTier: planTier('plan_tier').notNull().default('basic'),
  trialStartedAt: timestamp('trial_started_at', { withTimezone: true }),
  subscriptionStartedAt: timestamp('subscription_started_at', {
    withTimezone: true,
  }),
  storageAddOn: storageAddOn('storage_add_on').notNull().default('none'),
  ...timestamps(),
  ...softDeleteCol(),
  ...syncCols(),
});

import {
  index,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { accounts } from './accounts';
import { organizations } from './organizations';
import { idCol, softDeleteCol, syncCols, timestamps } from './_helpers';

// Raw value 'member' = the iOS "standard" role (kept for decode compatibility).
export const memberRole = pgEnum('member_role', [
  'owner',
  'admin',
  'manager',
  'member',
]);
export const memberStatus = pgEnum('member_status', ['invited', 'active']);

/**
 * A person in an organization. Mirrors the iOS `OrgMember`. `accountId` is null
 * for people invited by link who haven't redeemed yet; redeeming links the
 * account and flips status to `active`. `inviteCode` is globally unique among
 * non-null values (Postgres allows multiple NULLs under a unique index).
 */
export const orgMembers = pgTable(
  'org_members',
  {
    id: idCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id').references(() => accounts.id),
    name: varchar('name', { length: 200 }).notNull(),
    phoneNumber: varchar('phone_number', { length: 64 }).notNull().default(''),
    title: varchar('title', { length: 200 }).notNull().default(''),
    role: memberRole('role').notNull().default('member'),
    status: memberStatus('status').notNull().default('invited'),
    colorHex: varchar('color_hex', { length: 9 }).notNull().default('#13B5B1'),
    inviteCode: varchar('invite_code', { length: 16 }),
    inviteCreatedAt: timestamp('invite_created_at', { withTimezone: true }),
    ...timestamps(),
    ...softDeleteCol(),
    ...syncCols(),
  },
  (t) => [
    uniqueIndex('org_members_invite_code_idx').on(t.inviteCode),
    index('org_members_org_idx').on(t.organizationId),
    index('org_members_account_idx').on(t.accountId),
  ],
);

import {
  index,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { accounts } from './accounts';
import { idCol, timestamps } from './_helpers';

/**
 * A registered push device (APNs token) for an account. Tokens are unique;
 * re-registering updates the owning account. Used by the push-send worker.
 */
export const devices = pgTable(
  'devices',
  {
    id: idCol(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 400 }).notNull().unique(),
    platform: varchar('platform', { length: 20 }).notNull().default('ios'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps(),
  },
  (t) => [index('devices_account_idx').on(t.accountId)],
);

import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { accounts } from './accounts';

/**
 * Rotating refresh tokens. The token presented by the client is
 * `<row id>.<secret>`; only the argon2 hash of the secret is stored. Each
 * refresh rotates the row (`rotated_at`) and issues a new one in the same
 * `family_id`. Presenting an already-rotated token = reuse → the whole family
 * is revoked (likely theft).
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    familyId: uuid('family_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    userAgent: varchar('user_agent', { length: 400 }),
    ip: varchar('ip', { length: 64 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    rotatedAt: timestamp('rotated_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('refresh_tokens_account_idx').on(t.accountId),
    index('refresh_tokens_family_idx').on(t.familyId),
  ],
);

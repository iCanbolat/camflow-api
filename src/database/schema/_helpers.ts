import { sql } from 'drizzle-orm';
import { bigint, pgSequence, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Global monotonic sequence stamped into every row's `row_version` on insert.
 * The sync engine (Phase 2) uses `row_version` as the delta-pull cursor and
 * bumps it on update. A single global sequence keeps cursors comparable across
 * tables and free of clock skew.
 */
export const rowVersionSequence = pgSequence('row_version_seq', {
  startWith: 1,
  increment: 1,
});

/** Client-or-server generated UUID primary key (defaults server-side). */
export const idCol = () => uuid('id').primaryKey().defaultRandom();

/** `created_at` / `updated_at`, both timezone-aware, defaulting to now(). */
export const timestamps = () => ({
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Soft-delete marker — null means live, mirrors the iOS `deletedAt`. */
export const softDeleteCol = () => ({
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

/** Sync metadata shared by every replicated entity. */
export const syncCols = () => ({
  rowVersion: bigint('row_version', { mode: 'number' })
    .notNull()
    .default(sql`nextval('row_version_seq')`),
});

/**
 * SQL fragment that draws the next global row version. Use in update `.set(...)`
 * so a mutated row advances past every existing cursor:
 *   `.set({ updatedAt: new Date(), rowVersion: nextRowVersion() })`
 */
export const nextRowVersion = () => sql`nextval('row_version_seq')`;

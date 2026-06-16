import { pgEnum, pgTable, text, varchar } from 'drizzle-orm/pg-core';
import { idCol, softDeleteCol, syncCols, timestamps } from './_helpers';

export const accountProvider = pgEnum('account_provider', [
  'email',
  'google',
  'apple',
]);

/** The signed-in app user. Mirrors the iOS `Account` model. */
export const accounts = pgTable('accounts', {
  id: idCol(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  displayName: varchar('display_name', { length: 200 }).notNull(),
  provider: accountProvider('provider').notNull().default('email'),
  /** argon2id hash for the email provider; null for social accounts. */
  passwordHash: text('password_hash'),
  colorHex: varchar('color_hex', { length: 9 }).notNull().default('#13B5B1'),
  ...timestamps(),
  ...softDeleteCol(),
  ...syncCols(),
});

import { index, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { idCol, softDeleteCol, syncCols, timestamps } from './_helpers';

/**
 * Photo tag. Org-scoped (per-tenant taxonomy). Tag assignment is denormalized
 * as `photos.tagIds uuid[]` rather than a join table, which keeps the photo a
 * single LWW-replaceable row during sync.
 */
export const tags = pgTable(
  'tags',
  {
    id: idCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    colorHex: varchar('color_hex', { length: 9 }).notNull().default('#13B5B1'),
    ...timestamps(),
    ...softDeleteCol(),
    ...syncCols(),
  },
  (t) => [index('tags_org_rowver_idx').on(t.organizationId, t.rowVersion)],
);

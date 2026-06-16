import {
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { idCol, softDeleteCol, syncCols, timestamps } from './_helpers';

/** User-defined project status label. Org-scoped (per-tenant taxonomy). */
export const projectLabels = pgTable(
  'project_labels',
  {
    id: idCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    colorHex: varchar('color_hex', { length: 9 }).notNull().default('#1B98E0'),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
    ...softDeleteCol(),
    ...syncCols(),
  },
  (t) => [
    index('project_labels_org_rowver_idx').on(t.organizationId, t.rowVersion),
  ],
);

/** A job site / project. Mirrors the iOS `Project` model. */
export const projects = pgTable(
  'projects',
  {
    id: idCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    address: varchar('address', { length: 512 }).notNull().default(''),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    notes: text('notes').notNull().default(''),
    coverPhotoId: uuid('cover_photo_id'),
    labelId: uuid('label_id').references(() => projectLabels.id, {
      onDelete: 'set null',
    }),
    ...timestamps(),
    ...softDeleteCol(),
    ...syncCols(),
  },
  (t) => [index('projects_org_rowver_idx').on(t.organizationId, t.rowVersion)],
);

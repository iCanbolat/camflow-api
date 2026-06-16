import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { projects } from './projects';
import { idCol, softDeleteCol, syncCols, timestamps } from './_helpers';

export const reportLayout = pgEnum('report_layout', [
  'onePerPage',
  'twoPerPage',
  'fourPerPage',
]);
export const beforeAfterLayout = pgEnum('before_after_layout', [
  'sideBySide',
  'stacked',
]);

/** A PDF photo report definition. Mirrors iOS `Report`. */
export const reports = pgTable(
  'reports',
  {
    id: idCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    photoIds: uuid('photo_ids').array().notNull().default([]),
    // Per-photo notes keyed by photo id.
    photoNotes: jsonb('photo_notes')
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    layout: reportLayout('layout').notNull().default('onePerPage'),
    includesChecklistSummary: boolean('includes_checklist_summary')
      .notNull()
      .default(false),
    pdfFileName: varchar('pdf_file_name', { length: 255 }),
    ...timestamps(),
    ...softDeleteCol(),
    ...syncCols(),
  },
  (t) => [
    index('reports_org_rowver_idx').on(t.organizationId, t.rowVersion),
    index('reports_project_idx').on(t.projectId),
  ],
);

/** A before/after comparison. Mirrors iOS `BeforeAfterPair`. */
export const beforeAfterPairs = pgTable(
  'before_after_pairs',
  {
    id: idCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    beforePhotoId: uuid('before_photo_id').notNull(),
    afterPhotoId: uuid('after_photo_id').notNull(),
    layout: beforeAfterLayout('layout').notNull().default('sideBySide'),
    ...timestamps(),
    ...softDeleteCol(),
    ...syncCols(),
  },
  (t) => [
    index('before_after_pairs_org_rowver_idx').on(
      t.organizationId,
      t.rowVersion,
    ),
    index('before_after_pairs_project_idx').on(t.projectId),
  ],
);

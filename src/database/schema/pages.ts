import {
  index,
  integer,
  jsonb,
  pgTable,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { orgMembers } from './org-members';
import { organizations } from './organizations';
import { projects } from './projects';
import { idCol, softDeleteCol, syncCols, timestamps } from './_helpers';

/** Rich block-based project note. Mirrors iOS `Page` (contentData = block doc). */
export const pages = pgTable(
  'pages',
  {
    id: idCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    authorMemberId: uuid('author_member_id').references(() => orgMembers.id, {
      onDelete: 'set null',
    }),
    title: varchar('title', { length: 200 }).notNull().default(''),
    contentData: jsonb('content_data').notNull().default({}),
    sortOrder: integer('sort_order').notNull().default(0),
    pdfFileName: varchar('pdf_file_name', { length: 255 }),
    ...timestamps(),
    ...softDeleteCol(),
    ...syncCols(),
  },
  (t) => [
    index('pages_org_rowver_idx').on(t.organizationId, t.rowVersion),
    index('pages_project_idx').on(t.projectId),
  ],
);

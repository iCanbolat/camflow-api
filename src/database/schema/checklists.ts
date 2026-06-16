import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { orgMembers } from './org-members';
import { organizations } from './organizations';
import { projects } from './projects';
import { idCol, softDeleteCol, syncCols, timestamps } from './_helpers';

/** Reusable checklist blueprint. Mirrors iOS `ChecklistTemplate`. Org-scoped. */
export const checklistTemplates = pgTable(
  'checklist_templates',
  {
    id: idCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    itemTitles: text('item_titles').array().notNull().default([]),
    ...timestamps(),
    ...softDeleteCol(),
    ...syncCols(),
  },
  (t) => [
    index('checklist_templates_org_rowver_idx').on(
      t.organizationId,
      t.rowVersion,
    ),
  ],
);

/** A checklist instance on a project. Mirrors iOS `Checklist`. */
export const checklists = pgTable(
  'checklists',
  {
    id: idCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    assigneeMemberId: uuid('assignee_member_id').references(
      () => orgMembers.id,
      { onDelete: 'set null' },
    ),
    name: varchar('name', { length: 200 }).notNull(),
    templateId: uuid('template_id').references(() => checklistTemplates.id, {
      onDelete: 'set null',
    }),
    ...timestamps(),
    ...softDeleteCol(),
    ...syncCols(),
  },
  (t) => [
    index('checklists_org_rowver_idx').on(t.organizationId, t.rowVersion),
    index('checklists_project_idx').on(t.projectId),
  ],
);

/** A checklist line item. Mirrors iOS `ChecklistItem`. */
export const checklistItems = pgTable(
  'checklist_items',
  {
    id: idCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    checklistId: uuid('checklist_id')
      .notNull()
      .references(() => checklists.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 300 }).notNull(),
    isDone: boolean('is_done').notNull().default(false),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    photoId: uuid('photo_id'),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
    ...softDeleteCol(),
    ...syncCols(),
  },
  (t) => [
    index('checklist_items_org_rowver_idx').on(t.organizationId, t.rowVersion),
    index('checklist_items_checklist_idx').on(t.checklistId),
  ],
);

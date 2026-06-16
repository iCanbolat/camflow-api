import { pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { orgMembers } from './org-members';

/**
 * Project ↔ member assignment (many-to-many). The `projectId` FK to the
 * `projects` table is added in Phase 2 when that table lands; for now it is a
 * plain UUID so member-assignment can be recorded ahead of the domain schema.
 */
export const projectMembers = pgTable(
  'project_members',
  {
    projectId: uuid('project_id').notNull(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => orgMembers.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.memberId] })],
);

import { index, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { orgMembers } from './org-members';
import { projects } from './projects';

/**
 * Project ↔ member assignment (many-to-many). Drives which projects a member
 * is associated with for task assignment. Reconciled from the member side
 * (Phase 1 invite + REST); exposed in sync pull as `member.projectIds`.
 */
export const projectMembers = pgTable(
  'project_members',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id')
      .notNull()
      .references(() => orgMembers.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.memberId] }),
    index('project_members_member_idx').on(t.memberId),
  ],
);

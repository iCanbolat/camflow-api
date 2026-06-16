import {
  index,
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

/** A project task. Mirrors iOS `ProjectTask`. */
export const projectTasks = pgTable(
  'project_tasks',
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
    title: varchar('title', { length: 300 }).notNull(),
    note: text('note').notNull().default(''),
    dueDate: timestamp('due_date', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    attachedPhotoIds: uuid('attached_photo_ids').array().notNull().default([]),
    ...timestamps(),
    ...softDeleteCol(),
    ...syncCols(),
  },
  (t) => [
    index('project_tasks_org_rowver_idx').on(t.organizationId, t.rowVersion),
    index('project_tasks_project_idx').on(t.projectId),
  ],
);

/** Comment on a task (with @mentions). Mirrors iOS `TaskComment`. */
export const taskComments = pgTable(
  'task_comments',
  {
    id: idCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => projectTasks.id, { onDelete: 'cascade' }),
    authorMemberId: uuid('author_member_id').references(() => orgMembers.id, {
      onDelete: 'set null',
    }),
    text: text('text').notNull().default(''),
    mentionIds: uuid('mention_ids').array().notNull().default([]),
    ...timestamps(),
    ...softDeleteCol(),
    ...syncCols(),
  },
  (t) => [
    index('task_comments_org_rowver_idx').on(t.organizationId, t.rowVersion),
    index('task_comments_task_idx').on(t.taskId),
  ],
);

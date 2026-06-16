import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { checklists } from './checklists';
import { orgMembers } from './org-members';
import { organizations } from './organizations';
import { photos } from './photos';
import { projects } from './projects';
import { projectTasks } from './tasks';
import { idCol, softDeleteCol, syncCols, timestamps } from './_helpers';

export const notificationKind = pgEnum('notification_kind', [
  'taskAssigned',
  'checklistAssigned',
  'mention',
  'comment',
]);

/**
 * Per-recipient notification. Mirrors iOS `AppNotification`. Created server-side
 * by fan-out (Phase 4); in sync it is pull-only (clients receive + mark read).
 */
export const appNotifications = pgTable(
  'app_notifications',
  {
    id: idCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    recipientMemberId: uuid('recipient_member_id')
      .notNull()
      .references(() => orgMembers.id, { onDelete: 'cascade' }),
    actorMemberId: uuid('actor_member_id').references(() => orgMembers.id, {
      onDelete: 'set null',
    }),
    kind: notificationKind('kind').notNull(),
    taskId: uuid('task_id').references(() => projectTasks.id, {
      onDelete: 'set null',
    }),
    checklistId: uuid('checklist_id').references(() => checklists.id, {
      onDelete: 'set null',
    }),
    photoId: uuid('photo_id').references(() => photos.id, {
      onDelete: 'set null',
    }),
    projectId: uuid('project_id').references(() => projects.id, {
      onDelete: 'set null',
    }),
    bodySnippet: text('body_snippet').notNull().default(''),
    isRead: boolean('is_read').notNull().default(false),
    readAt: timestamp('read_at', { withTimezone: true }),
    ...timestamps(),
    ...softDeleteCol(),
    ...syncCols(),
  },
  (t) => [
    index('app_notifications_recipient_rowver_idx').on(
      t.recipientMemberId,
      t.rowVersion,
    ),
    index('app_notifications_org_rowver_idx').on(
      t.organizationId,
      t.rowVersion,
    ),
  ],
);

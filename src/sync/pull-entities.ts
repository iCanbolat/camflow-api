import {
  appNotifications,
  beforeAfterPairs,
  checklistItems,
  checklists,
  checklistTemplates,
  measurements,
  orgMembers,
  organizations,
  pages,
  photoComments,
  photos,
  projectLabels,
  projects,
  projectTasks,
  reports,
  tags,
  taskComments,
} from '../database/schema';

/**
 * Entities returned by sync pull. Includes the push entities plus pull-only
 * ones (organization, member, notification) so the client receives org/roster/
 * notification deltas through the same cursor. Tombstones (soft-deleted rows)
 * are included so clients can remove local copies.
 */
export type PullScope =
  | 'self' // the org row itself (id = orgId)
  | 'org' // organization_id = orgId
  | 'notification'; // org + recipient = caller's membership

export interface PullEntityDef {
  table: any;
  scope: PullScope;
}

export const PULL_ENTITIES: Record<string, PullEntityDef> = {
  organization: { table: organizations, scope: 'self' },
  member: { table: orgMembers, scope: 'org' },
  project: { table: projects, scope: 'org' },
  projectLabel: { table: projectLabels, scope: 'org' },
  tag: { table: tags, scope: 'org' },
  photo: { table: photos, scope: 'org' },
  photoComment: { table: photoComments, scope: 'org' },
  task: { table: projectTasks, scope: 'org' },
  taskComment: { table: taskComments, scope: 'org' },
  checklist: { table: checklists, scope: 'org' },
  checklistItem: { table: checklistItems, scope: 'org' },
  checklistTemplate: { table: checklistTemplates, scope: 'org' },
  report: { table: reports, scope: 'org' },
  beforeAfterPair: { table: beforeAfterPairs, scope: 'org' },
  page: { table: pages, scope: 'org' },
  measurement: { table: measurements, scope: 'org' },
  notification: { table: appNotifications, scope: 'notification' },
};

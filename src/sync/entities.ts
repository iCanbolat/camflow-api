import {
  beforeAfterPairs,
  checklistItems,
  checklists,
  checklistTemplates,
  measurements,
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
 * Sync entity registry. The push engine is generic: each definition supplies
 * the target table, a mutation policy (how permission is enforced), and a
 * `columns` mapper from the client payload to entity-specific column values
 * (id / organizationId / timestamps / row_version are handled centrally).
 */
export type SyncPolicy =
  | 'member' // any active member may upsert/delete
  | 'taxonomy' // requires manageTaxonomy
  | 'project' // upsert: any member; delete: deleteProject
  | 'task' // manageTasks, or the assignee may update their own
  | 'checklist' // manageTasks, or the assignee may update their own
  | 'checklistItem'; // manageTasks, or the parent checklist's assignee

type Json = Record<string, unknown>;

const date = (v: unknown): Date | null => (v ? new Date(v as string) : null);
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const str = (v: unknown, fallback = ''): string =>
  typeof v === 'string' ? v : fallback;
const num = (v: unknown): number | null =>
  typeof v === 'number' ? v : null;

export interface PushEntityDef {
  table: any;
  policy: SyncPolicy;
  columns: (p: Json) => Record<string, unknown>;
}

/** Entities the client may push (create/update/delete). */
export const PUSH_ENTITIES: Record<string, PushEntityDef> = {
  project: {
    table: projects,
    policy: 'project',
    columns: (p) => ({
      name: str(p.name),
      address: str(p.address),
      latitude: num(p.latitude),
      longitude: num(p.longitude),
      notes: str(p.notes),
      coverPhotoId: (p.coverPhotoId as string) ?? null,
      labelId: (p.labelId as string) ?? null,
    }),
  },
  projectLabel: {
    table: projectLabels,
    policy: 'taxonomy',
    columns: (p) => ({
      name: str(p.name),
      colorHex: str(p.colorHex, '#1B98E0'),
      sortOrder: num(p.sortOrder) ?? 0,
    }),
  },
  tag: {
    table: tags,
    policy: 'taxonomy',
    columns: (p) => ({
      name: str(p.name),
      colorHex: str(p.colorHex, '#13B5B1'),
    }),
  },
  photo: {
    table: photos,
    policy: 'member',
    columns: (p) => ({
      projectId: (p.projectId as string) ?? null,
      authorMemberId: (p.authorMemberId as string) ?? null,
      capturedAt: date(p.capturedAt) ?? new Date(),
      latitude: num(p.latitude),
      longitude: num(p.longitude),
      fileName: str(p.fileName),
      thumbnailFileName: str(p.thumbnailFileName),
      caption: str(p.caption),
      annotationData: p.annotationData ?? null,
      source: str(p.source, 'camera'),
      mediaType: str(p.mediaType, 'photo'),
      durationSeconds: num(p.durationSeconds),
      tagIds: arr<string>(p.tagIds),
    }),
  },
  photoComment: {
    table: photoComments,
    policy: 'member',
    columns: (p) => ({
      photoId: p.photoId as string,
      authorMemberId: (p.authorMemberId as string) ?? null,
      text: str(p.text),
      mentionIds: arr<string>(p.mentionIds),
    }),
  },
  task: {
    table: projectTasks,
    policy: 'task',
    columns: (p) => ({
      projectId: p.projectId as string,
      assigneeMemberId: (p.assigneeMemberId as string) ?? null,
      title: str(p.title),
      note: str(p.note),
      dueDate: date(p.dueDate),
      completedAt: date(p.completedAt),
      attachedPhotoIds: arr<string>(p.attachedPhotoIds),
    }),
  },
  taskComment: {
    table: taskComments,
    policy: 'member',
    columns: (p) => ({
      taskId: p.taskId as string,
      authorMemberId: (p.authorMemberId as string) ?? null,
      text: str(p.text),
      mentionIds: arr<string>(p.mentionIds),
    }),
  },
  checklist: {
    table: checklists,
    policy: 'checklist',
    columns: (p) => ({
      projectId: p.projectId as string,
      assigneeMemberId: (p.assigneeMemberId as string) ?? null,
      name: str(p.name),
      templateId: (p.templateId as string) ?? null,
    }),
  },
  checklistItem: {
    table: checklistItems,
    policy: 'checklistItem',
    columns: (p) => ({
      checklistId: p.checklistId as string,
      title: str(p.title),
      isDone: Boolean(p.isDone),
      completedAt: date(p.completedAt),
      photoId: (p.photoId as string) ?? null,
      sortOrder: num(p.sortOrder) ?? 0,
    }),
  },
  checklistTemplate: {
    table: checklistTemplates,
    policy: 'taxonomy',
    columns: (p) => ({
      name: str(p.name),
      itemTitles: arr<string>(p.itemTitles),
    }),
  },
  report: {
    table: reports,
    policy: 'member',
    columns: (p) => ({
      projectId: p.projectId as string,
      title: str(p.title),
      photoIds: arr<string>(p.photoIds),
      photoNotes: (p.photoNotes as Record<string, string>) ?? {},
      layout: str(p.layout, 'onePerPage'),
      includesChecklistSummary: Boolean(p.includesChecklistSummary),
      pdfFileName: (p.pdfFileName as string) ?? null,
    }),
  },
  beforeAfterPair: {
    table: beforeAfterPairs,
    policy: 'member',
    columns: (p) => ({
      projectId: p.projectId as string,
      beforePhotoId: p.beforePhotoId as string,
      afterPhotoId: p.afterPhotoId as string,
      layout: str(p.layout, 'sideBySide'),
    }),
  },
  page: {
    table: pages,
    policy: 'member',
    columns: (p) => ({
      projectId: p.projectId as string,
      authorMemberId: (p.authorMemberId as string) ?? null,
      title: str(p.title),
      contentData: p.contentData ?? {},
      sortOrder: num(p.sortOrder) ?? 0,
      pdfFileName: (p.pdfFileName as string) ?? null,
    }),
  },
  measurement: {
    table: measurements,
    policy: 'member',
    columns: (p) => ({
      projectId: (p.projectId as string) ?? null,
      capturedAt: date(p.capturedAt) ?? new Date(),
      unit: str(p.unit, 'meters'),
      segmentsData: p.segmentsData ?? [],
      totalMeters: num(p.totalMeters) ?? 0,
      snapshotPhotoId: (p.snapshotPhotoId as string) ?? null,
      notes: str(p.notes),
    }),
  },
};

export type PushEntityKey = keyof typeof PUSH_ENTITIES;

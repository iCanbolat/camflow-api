import {
  bigint,
  doublePrecision,
  index,
  jsonb,
  pgEnum,
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

export const photoSource = pgEnum('photo_source', ['camera', 'imported']);
export const mediaType = pgEnum('media_type', ['photo', 'video']);
export const mediaProcessingStatus = pgEnum('media_processing_status', [
  'pending', // row exists, no bytes uploaded yet
  'queued', // raw bytes committed, processing job enqueued
  'processing',
  'done',
  'failed',
]);

/**
 * Photo or video. Mirrors iOS `Photo`. `fileName`/`thumbnailFileName` become
 * Bunny object keys in Phase 3 (media-processing columns added then). Tag
 * assignment is denormalized in `tagIds`. Annotations are stored as JSON.
 */
export const photos = pgTable(
  'photos',
  {
    id: idCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, {
      onDelete: 'cascade',
    }),
    authorMemberId: uuid('author_member_id').references(() => orgMembers.id, {
      onDelete: 'set null',
    }),
    capturedAt: timestamp('captured_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    fileName: varchar('file_name', { length: 255 }).notNull().default(''),
    thumbnailFileName: varchar('thumbnail_file_name', { length: 255 })
      .notNull()
      .default(''),
    caption: text('caption').notNull().default(''),
    annotationData: jsonb('annotation_data'),
    source: photoSource('source').notNull().default('camera'),
    mediaType: mediaType('media_type').notNull().default('photo'),
    durationSeconds: doublePrecision('duration_seconds'),
    tagIds: uuid('tag_ids').array().notNull().default([]),
    // --- Media pipeline (Phase 3): server-managed, not set by sync push ---
    processingStatus: mediaProcessingStatus('processing_status')
      .notNull()
      .default('pending'),
    rawObjectKey: varchar('raw_object_key', { length: 512 }),
    processedObjectKey: varchar('processed_object_key', { length: 512 }),
    thumbnailObjectKey: varchar('thumbnail_object_key', { length: 512 }),
    watermarkedObjectKey: varchar('watermarked_object_key', { length: 512 }),
    byteSize: bigint('byte_size', { mode: 'number' }),
    processingError: text('processing_error'),
    ...timestamps(),
    ...softDeleteCol(),
    ...syncCols(),
  },
  (t) => [
    index('photos_org_rowver_idx').on(t.organizationId, t.rowVersion),
    index('photos_project_idx').on(t.projectId),
  ],
);

/** Comment thread on a photo. Mirrors iOS `PhotoComment`. */
export const photoComments = pgTable(
  'photo_comments',
  {
    id: idCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    photoId: uuid('photo_id')
      .notNull()
      .references(() => photos.id, { onDelete: 'cascade' }),
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
    index('photo_comments_org_rowver_idx').on(t.organizationId, t.rowVersion),
    index('photo_comments_photo_idx').on(t.photoId),
  ],
);

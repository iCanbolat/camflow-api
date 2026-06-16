import {
  doublePrecision,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { projects } from './projects';
import { idCol, softDeleteCol, syncCols, timestamps } from './_helpers';

export const measureUnit = pgEnum('measure_unit', ['meters', 'feet']);

/** AR point-to-point measurement session. Mirrors iOS `Measurement`. */
export const measurements = pgTable(
  'measurements',
  {
    id: idCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, {
      onDelete: 'cascade',
    }),
    capturedAt: timestamp('captured_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    unit: measureUnit('unit').notNull().default('meters'),
    segmentsData: jsonb('segments_data').notNull().default([]),
    totalMeters: doublePrecision('total_meters').notNull().default(0),
    snapshotPhotoId: uuid('snapshot_photo_id'),
    notes: text('notes').notNull().default(''),
    ...timestamps(),
    ...softDeleteCol(),
    ...syncCols(),
  },
  (t) => [
    index('measurements_org_rowver_idx').on(t.organizationId, t.rowVersion),
    index('measurements_project_idx').on(t.projectId),
  ],
);

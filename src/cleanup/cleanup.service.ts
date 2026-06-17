import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, isNotNull, lt, or } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  appNotifications,
  beforeAfterPairs,
  checklistItems,
  checklists,
  checklistTemplates,
  measurements,
  orgMembers,
  pages,
  photoComments,
  photos,
  projectLabels,
  projects,
  projectTasks,
  refreshTokens,
  reports,
  tags,
  taskComments,
} from '../database/schema';

const DAY_MS = 24 * 60 * 60 * 1000;

// Tombstone tables in child→parent order so cascading FKs don't surprise us.
const TOMBSTONE_TABLES = [
  photoComments,
  taskComments,
  checklistItems,
  appNotifications,
  photos,
  projectTasks,
  checklists,
  reports,
  beforeAfterPairs,
  pages,
  measurements,
  tags,
  projectLabels,
  checklistTemplates,
  projects,
  orgMembers,
] as const;

/**
 * Retention jobs (run by the cleanup worker). Idempotency keys are not handled
 * here — Redis TTL expires them automatically.
 */
@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly config: ConfigService,
  ) {}

  /** Delete expired or long-revoked refresh tokens. */
  async purgeRefreshTokens(): Promise<number> {
    const grace = this.config.get<number>('REFRESH_TOKEN_GRACE_DAYS', 7);
    const cutoff = new Date(Date.now() - grace * DAY_MS);
    const deleted = await this.db
      .delete(refreshTokens)
      .where(
        or(
          lt(refreshTokens.expiresAt, cutoff),
          and(
            isNotNull(refreshTokens.revokedAt),
            lt(refreshTokens.revokedAt, cutoff),
          ),
        ),
      )
      .returning({ id: refreshTokens.id });
    this.logger.log(`Purged ${deleted.length} refresh tokens.`);
    return deleted.length;
  }

  /**
   * Hard-delete rows soft-deleted beyond the retention window. The window must
   * exceed the 7-day device purge so every device has synced the delete first.
   */
  async pruneTombstones(): Promise<number> {
    const retention = this.config.get<number>('TOMBSTONE_RETENTION_DAYS', 30);
    const cutoff = new Date(Date.now() - retention * DAY_MS);
    let total = 0;
    for (const table of TOMBSTONE_TABLES) {
      const deleted = await this.db
        .delete(table as any)
        .where(
          and(
            isNotNull((table as any).deletedAt),
            lt((table as any).deletedAt, cutoff),
          ),
        )
        .returning({ id: (table as any).id });
      total += deleted.length;
    }
    this.logger.log(
      `Pruned ${total} tombstoned rows (retention ${retention}d).`,
    );
    return total;
  }
}

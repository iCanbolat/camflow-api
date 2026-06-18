import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import { nextRowVersion, organizations, photos } from '../database/schema';
import { QUEUE_MEDIA_PROCESS } from '../queue/queue.constants';
import { RedisService } from '../redis/redis.service';
import { STORAGE, type StorageProvider } from '../storage/storage.provider';
import { processImage } from './image.processor';
import { processedKey, thumbnailKey, watermarkedKey } from './media-keys';
import { processVideo } from './video.processor';

interface MediaJob {
  photoId: string;
}

/**
 * Downloads the raw upload, generates compressed + thumbnail + watermarked
 * derivatives (photos via sharp, videos via ffmpeg), re-uploads them, flips the
 * row to `done`, and publishes a change event. Bumps `row_version` (not
 * `updated_at`) so pull delivers the processed status without disturbing LWW.
 */
@Processor(QUEUE_MEDIA_PROCESS, { concurrency: 3 })
export class MediaProcessWorker extends WorkerHost {
  private readonly logger = new Logger(MediaProcessWorker.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(STORAGE) private readonly storage: StorageProvider,
    private readonly redis: RedisService,
  ) {
    super();
  }

  async process(job: Job<MediaJob>): Promise<void> {
    const { photoId } = job.data;
    const photo = await this.db.query.photos.findFirst({
      where: eq(photos.id, photoId),
    });
    if (!photo || !photo.rawObjectKey) {
      this.logger.warn(`Skipping ${photoId}: no raw object.`);
      return;
    }

    await this.setStatus(photoId, 'processing');

    try {
      const raw = await this.storage.download(photo.rawObjectKey);
      const orgId = photo.organizationId;

      let keys: {
        processed: string;
        thumbnail: string;
        watermarked: string | null;
      };
      let byteSize: number;

      if (photo.mediaType === 'video') {
        const { processed, poster } = await processVideo(raw);
        keys = {
          processed: processedKey(orgId, photoId, true),
          thumbnail: thumbnailKey(orgId, photoId),
          watermarked: null,
        };
        await this.storage.upload(keys.processed, processed, 'video/mp4');
        await this.storage.upload(keys.thumbnail, poster, 'image/jpeg');
        byteSize = processed.length + poster.length;
      } else {
        const org = await this.db.query.organizations.findFirst({
          where: eq(organizations.id, orgId),
        });
        const result = await processImage(raw, {
          companyName: org?.name ?? 'CamFlow',
          capturedAt: photo.capturedAt,
          latitude: photo.latitude,
          longitude: photo.longitude,
          accuracyM: photo.locationAccuracyM,
          verification: photo.captureVerification,
          signature: photo.captureSignature,
        });
        keys = {
          processed: processedKey(orgId, photoId, false),
          thumbnail: thumbnailKey(orgId, photoId),
          watermarked: watermarkedKey(orgId, photoId),
        };
        await this.storage.upload(
          keys.processed,
          result.processed,
          'image/jpeg',
        );
        await this.storage.upload(
          keys.thumbnail,
          result.thumbnail,
          'image/jpeg',
        );
        await this.storage.upload(
          keys.watermarked!,
          result.watermarked,
          'image/jpeg',
        );
        byteSize =
          result.processed.length +
          result.thumbnail.length +
          result.watermarked.length;
      }

      const [row] = await this.db
        .update(photos)
        .set({
          processingStatus: 'done',
          processedObjectKey: keys.processed,
          thumbnailObjectKey: keys.thumbnail,
          watermarkedObjectKey: keys.watermarked,
          byteSize,
          processingError: null,
          rawObjectKey: null, // raw no longer needed once derivatives exist
          rowVersion: nextRowVersion(),
        })
        .where(eq(photos.id, photoId))
        .returning();

      // Free the raw upload now that derivatives are stored.
      await this.storage.delete(photo.rawObjectKey).catch(() => undefined);
      await this.publish(orgId, photoId, Number(row.rowVersion));
      this.logger.log(
        `Processed ${photoId} (${photo.mediaType}, ${byteSize}B).`,
      );
    } catch (e) {
      const message =
        (e as Error).message?.slice(0, 480) ?? 'processing failed';
      await this.db
        .update(photos)
        .set({
          processingStatus: 'failed',
          processingError: message,
          rowVersion: nextRowVersion(),
        })
        .where(eq(photos.id, photoId));
      throw e; // let BullMQ apply retry/backoff
    }
  }

  private async setStatus(photoId: string, status: 'processing') {
    await this.db
      .update(photos)
      .set({ processingStatus: status, rowVersion: nextRowVersion() })
      .where(eq(photos.id, photoId));
  }

  private async publish(orgId: string, photoId: string, rowVersion: number) {
    try {
      await this.redis.publisher.publish(
        `org:${orgId}`,
        JSON.stringify({
          entity: 'photo',
          id: photoId,
          op: 'upsert',
          rowVersion,
        }),
      );
    } catch {
      // best-effort
    }
  }
}

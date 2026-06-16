import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  nextRowVersion,
  orgMembers,
  organizations,
  photos,
} from '../database/schema';
import { effectiveStorageBytes } from '../organizations/plan';
import { QUEUE_MEDIA_PROCESS } from '../queue/queue.constants';
import { STORAGE, type StorageProvider } from '../storage/storage.provider';
import {
  belongsToPhoto,
  rawKey,
} from './media-keys';
import { CommitUploadDto, UploadTicketDto } from './media.dto';
import { signUploadToken, verifyUploadToken } from './upload-token';

const MAX_PHOTO_BYTES = 50_000_000; // 50 MB
const MAX_VIDEO_BYTES = 2_000_000_000; // 2 GB
const UPLOAD_TTL_SECONDS = 600;
const SIGNED_URL_TTL_SECONDS = 3600;

@Injectable()
export class MediaService {
  private readonly uploadSecret: string;
  private readonly apiBase: string;

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(STORAGE) private readonly storage: StorageProvider,
    @InjectQueue(QUEUE_MEDIA_PROCESS) private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {
    this.uploadSecret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
    const port = config.get<number>('PORT', 3000);
    this.apiBase = config.get<string>(
      'API_PUBLIC_URL',
      `http://localhost:${port}`,
    );
  }

  /** Mint a signed direct-upload ticket; bytes never touch this method. */
  async createUploadTicket(accountId: string, dto: UploadTicketDto) {
    await this.requireMembership(accountId, dto.organizationId);

    const maxBytes =
      dto.mediaType === 'video' ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES;
    if (dto.byteSize > maxBytes) {
      throw new BadRequestException({
        code: 'tooLarge',
        message: `Exceeds the ${dto.mediaType} size limit.`,
      });
    }

    const key = rawKey(dto.organizationId, dto.photoId, dto.ext);
    const exp = Math.floor(Date.now() / 1000) + UPLOAD_TTL_SECONDS;
    const token = signUploadToken(
      {
        key,
        photoId: dto.photoId,
        organizationId: dto.organizationId,
        mediaType: dto.mediaType,
        maxBytes,
        exp,
      },
      this.uploadSecret,
    );

    return {
      uploadUrl: `${this.apiBase}/api/v1/media/upload?token=${encodeURIComponent(token)}`,
      method: 'PUT',
      objectKey: key,
      maxBytes,
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  /** Authenticated streaming proxy: pipe the request body straight to storage. */
  async handleUpload(
    token: string,
    stream: NodeJS.ReadableStream,
    contentType?: string,
  ) {
    const payload = this.verifyToken(token);
    const result = await this.storage.uploadStream(payload.key, stream, {
      maxBytes: payload.maxBytes,
      contentType,
    });
    return { objectKey: payload.key, byteSize: result.byteSize };
  }

  /** Link the uploaded raw object to the photo row and enqueue processing. */
  async commit(accountId: string, dto: CommitUploadDto) {
    await this.requireMembership(accountId, dto.organizationId);

    if (!belongsToPhoto(dto.objectKey, dto.organizationId, dto.photoId)) {
      throw new BadRequestException({
        code: 'badObjectKey',
        message: 'Object key does not match the photo.',
      });
    }

    await this.db
      .insert(photos)
      .values({
        id: dto.photoId,
        organizationId: dto.organizationId,
        projectId: dto.projectId ?? null,
        mediaType: dto.mediaType,
        rawObjectKey: dto.objectKey,
        processingStatus: 'queued',
      })
      .onConflictDoUpdate({
        target: photos.id,
        set: {
          rawObjectKey: dto.objectKey,
          mediaType: dto.mediaType,
          processingStatus: 'queued',
          processingError: null,
          rowVersion: nextRowVersion(),
        },
      });

    await this.queue.add('process', { photoId: dto.photoId });
    return { photoId: dto.photoId, status: 'queued' as const };
  }

  /** Signed CDN URLs for the processed variants. */
  async urls(accountId: string, photoId: string, organizationId: string) {
    await this.requireMembership(accountId, organizationId);
    const photo = await this.loadPhoto(photoId, organizationId);
    const sign = (key: string | null) =>
      key ? this.storage.signedDownloadUrl(key, SIGNED_URL_TTL_SECONDS) : null;
    return {
      photoId,
      status: photo.processingStatus,
      processed: sign(photo.processedObjectKey),
      thumbnail: sign(photo.thumbnailObjectKey),
      watermarked: sign(photo.watermarkedObjectKey),
    };
  }

  async reprocess(accountId: string, photoId: string, organizationId: string) {
    await this.requireMembership(accountId, organizationId);
    const photo = await this.loadPhoto(photoId, organizationId);
    if (!photo.rawObjectKey) {
      throw new BadRequestException({
        code: 'noRawMedia',
        message: 'No uploaded media to reprocess.',
      });
    }
    await this.db
      .update(photos)
      .set({
        processingStatus: 'queued',
        processingError: null,
        rowVersion: nextRowVersion(),
      })
      .where(eq(photos.id, photoId));
    await this.queue.add('process', { photoId });
    return { photoId, status: 'queued' as const };
  }

  async usage(accountId: string, organizationId: string) {
    await this.requireMembership(accountId, organizationId);
    const [row] = await this.db
      .select({ used: sql<string>`coalesce(sum(${photos.byteSize}), 0)` })
      .from(photos)
      .where(
        and(eq(photos.organizationId, organizationId), isNull(photos.deletedAt)),
      );
    const org = await this.db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
    });
    const limit = org
      ? effectiveStorageBytes({
          planTier: org.planTier,
          trialStartedAt: org.trialStartedAt,
          subscriptionStartedAt: org.subscriptionStartedAt,
          storageAddOn: org.storageAddOn,
        })
      : 0;
    return { usedBytes: Number(row?.used ?? 0), limitBytes: limit };
  }

  /** Serve a local-driver object (dev only); returns the bytes. */
  download(key: string): Promise<Buffer> {
    return this.storage.download(key);
  }

  // --- internals --------------------------------------------------------

  private verifyToken(token: string) {
    try {
      return verifyUploadToken(token, this.uploadSecret);
    } catch (e) {
      throw new ForbiddenException({
        code: 'badUploadToken',
        message: (e as Error).message,
      });
    }
  }

  private async loadPhoto(photoId: string, organizationId: string) {
    const photo = await this.db.query.photos.findFirst({
      where: and(eq(photos.id, photoId), isNull(photos.deletedAt)),
    });
    if (!photo || photo.organizationId !== organizationId) {
      throw new NotFoundException('Photo not found.');
    }
    return photo;
  }

  private async requireMembership(accountId: string, organizationId: string) {
    const member = await this.db.query.orgMembers.findFirst({
      where: and(
        eq(orgMembers.accountId, accountId),
        eq(orgMembers.organizationId, organizationId),
        isNull(orgMembers.deletedAt),
      ),
    });
    if (!member || member.status !== 'active') {
      throw new ForbiddenException({
        code: 'notMember',
        message: 'You are not a member of this organization.',
      });
    }
    return member;
  }
}

import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { Readable } from 'stream';
import { PutResult, StorageProvider } from './storage.provider';

/**
 * Bunny.net Edge Storage + Pull Zone implementation.
 *
 * - Uploads/downloads/deletes use the Storage API with the zone `AccessKey`.
 * - Edge Storage has no S3-style presigned PUT, so direct client uploads go
 *   through the authenticated streaming proxy (MediaController) which calls
 *   `uploadStream` here — constant memory, never base64/batched.
 * - Downloads are signed Pull Zone URLs (Token Authentication, SHA256 variant).
 */
@Injectable()
export class BunnyStorageService implements StorageProvider {
  // Resolved lazily so the provider can be constructed even in local mode
  // (env validation already guards the bunny driver — see env.ts superRefine).
  private resolved?: {
    storageBase: string;
    accessKey: string;
    pullZoneHost: string;
    pullZoneToken: string;
  };

  constructor(private readonly config: ConfigService) {}

  private get cfg() {
    if (!this.resolved) {
      const zone = this.config.getOrThrow<string>('BUNNY_STORAGE_ZONE');
      const host = this.config.get<string>(
        'BUNNY_STORAGE_HOST',
        'storage.bunnycdn.com',
      );
      this.resolved = {
        storageBase: `https://${host}/${zone}/`,
        accessKey: this.config.getOrThrow<string>('BUNNY_STORAGE_PASSWORD'),
        pullZoneHost: this.config.getOrThrow<string>('BUNNY_PULL_ZONE_HOST'),
        pullZoneToken: this.config.getOrThrow<string>('BUNNY_PULL_ZONE_TOKEN'),
      };
    }
    return this.resolved;
  }

  private url(key: string): string {
    return this.cfg.storageBase + encodeURI(key);
  }

  async uploadStream(
    key: string,
    stream: NodeJS.ReadableStream,
    opts: { maxBytes: number; contentType?: string },
  ): Promise<PutResult> {
    let byteSize = 0;
    const counted = new Readable().wrap(stream);
    counted.on('data', (chunk: Buffer) => {
      byteSize += chunk.length;
      if (byteSize > opts.maxBytes) {
        counted.destroy(new Error('Upload exceeds the maximum allowed size.'));
      }
    });

    const res = await fetch(this.url(key), {
      method: 'PUT',
      headers: {
        AccessKey: this.cfg.accessKey,
        'Content-Type': opts.contentType ?? 'application/octet-stream',
      },
      body: counted as unknown as ReadableStream,
      // Node fetch requires duplex for a streaming request body.
      duplex: 'half',
    } as RequestInit);

    if (!res.ok) {
      throw new InternalServerErrorException(
        `Bunny upload failed (${res.status}).`,
      );
    }
    return { byteSize };
  }

  async upload(
    key: string,
    data: Buffer,
    contentType: string,
  ): Promise<PutResult> {
    const res = await fetch(this.url(key), {
      method: 'PUT',
      headers: { AccessKey: this.cfg.accessKey, 'Content-Type': contentType },
      body: new Uint8Array(data),
    });
    if (!res.ok) {
      throw new InternalServerErrorException(
        `Bunny upload failed (${res.status}).`,
      );
    }
    return { byteSize: data.length };
  }

  async download(key: string): Promise<Buffer> {
    const res = await fetch(this.url(key), {
      headers: { AccessKey: this.cfg.accessKey },
    });
    if (!res.ok) {
      throw new InternalServerErrorException(
        `Bunny download failed (${res.status}).`,
      );
    }
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    await fetch(this.url(key), {
      method: 'DELETE',
      headers: { AccessKey: this.cfg.accessKey },
    });
  }

  async exists(key: string): Promise<boolean> {
    const res = await fetch(this.url(key), {
      method: 'GET',
      headers: { AccessKey: this.cfg.accessKey, Range: 'bytes=0-0' },
    });
    return res.ok;
  }

  /**
   * Bunny Pull Zone Token Authentication (SHA256). Signs `securityKey + path +
   * expires` and appends `?token=&expires=`. URL-safe base64.
   */
  signedDownloadUrl(key: string, ttlSeconds: number): string {
    const path = '/' + key;
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    const hash = createHash('sha256')
      .update(this.cfg.pullZoneToken + path + expires)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    return `https://${this.cfg.pullZoneHost}${encodeURI(path)}?token=${hash}&expires=${expires}`;
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWriteStream } from 'fs';
import { mkdir, readFile, rm, stat, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { PassThrough } from 'stream';
import { pipeline } from 'stream/promises';
import { PutResult, StorageProvider } from './storage.provider';

/**
 * Filesystem-backed storage for dev/test (STORAGE_DRIVER=local). Keys map to
 * nested paths under STORAGE_LOCAL_DIR. Signed URLs point back at the local
 * file-serving route.
 */
@Injectable()
export class LocalStorageService implements StorageProvider {
  private readonly baseDir: string;
  private readonly publicBase: string;

  constructor(config: ConfigService) {
    this.baseDir = resolve(
      config.get<string>('STORAGE_LOCAL_DIR', './storage'),
    );
    const port = config.get<number>('PORT', 3000);
    this.publicBase = config.get<string>(
      'API_PUBLIC_URL',
      `http://localhost:${port}`,
    );
  }

  private path(key: string): string {
    return join(this.baseDir, key);
  }

  async uploadStream(
    key: string,
    stream: NodeJS.ReadableStream,
    opts: { maxBytes: number },
  ): Promise<PutResult> {
    const target = this.path(key);
    await mkdir(dirname(target), { recursive: true });

    let byteSize = 0;
    const counter = new PassThrough();
    counter.on('data', (chunk: Buffer) => {
      byteSize += chunk.length;
      if (byteSize > opts.maxBytes) {
        counter.destroy(new Error('Upload exceeds the maximum allowed size.'));
      }
    });

    await pipeline(stream, counter, createWriteStream(target));
    return { byteSize };
  }

  async upload(key: string, data: Buffer): Promise<PutResult> {
    const target = this.path(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
    return { byteSize: data.length };
  }

  download(key: string): Promise<Buffer> {
    return readFile(this.path(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.path(key));
      return true;
    } catch {
      return false;
    }
  }

  signedDownloadUrl(key: string): string {
    // No signing locally; the file route streams from disk.
    return `${this.publicBase}/api/v1/media/file/${key}`;
  }
}

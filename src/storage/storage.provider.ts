/** DI token for the active StorageProvider (Bunny in prod, Local in dev). */
export const STORAGE = Symbol('STORAGE');

export interface PutResult {
  byteSize: number;
}

/**
 * Object-storage abstraction. The Bunny implementation talks to Edge Storage +
 * a Pull Zone for signed downloads; the Local implementation writes to disk for
 * dev/test. The interface stays swappable to S3-compatible storage.
 */
export interface StorageProvider {
  /** Stream an upload (constant memory, never base64). Enforces `maxBytes`. */
  uploadStream(
    key: string,
    stream: NodeJS.ReadableStream,
    opts: { maxBytes: number; contentType?: string },
  ): Promise<PutResult>;

  /** Upload a buffer (worker-generated derivatives). */
  upload(key: string, data: Buffer, contentType: string): Promise<PutResult>;

  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;

  /** A time-limited URL the client can GET (CDN token auth in prod). */
  signedDownloadUrl(key: string, ttlSeconds: number): string;
}

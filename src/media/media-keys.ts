/**
 * Object-key layout in the storage zone. One folder per photo holds the raw
 * upload plus the worker-generated derivatives.
 *
 *   org/<orgId>/media/<photoId>/raw.<ext>
 *                              /processed.jpg | processed.mp4
 *                              /thumb.jpg
 *                              /watermarked.jpg
 */
const SAFE_EXT = /^[a-z0-9]{1,5}$/i;

export function mediaPrefix(orgId: string, photoId: string): string {
  return `org/${orgId}/media/${photoId}`;
}

export function rawKey(orgId: string, photoId: string, ext: string): string {
  const safe = SAFE_EXT.test(ext) ? ext.toLowerCase() : 'bin';
  return `${mediaPrefix(orgId, photoId)}/raw.${safe}`;
}

export function processedKey(
  orgId: string,
  photoId: string,
  video = false,
): string {
  return `${mediaPrefix(orgId, photoId)}/processed.${video ? 'mp4' : 'jpg'}`;
}

export function thumbnailKey(orgId: string, photoId: string): string {
  return `${mediaPrefix(orgId, photoId)}/thumb.jpg`;
}

export function watermarkedKey(orgId: string, photoId: string): string {
  return `${mediaPrefix(orgId, photoId)}/watermarked.jpg`;
}

/** True if `key` lives under the photo's folder (commit/upload validation). */
export function belongsToPhoto(
  key: string,
  orgId: string,
  photoId: string,
): boolean {
  return key.startsWith(`${mediaPrefix(orgId, photoId)}/`);
}

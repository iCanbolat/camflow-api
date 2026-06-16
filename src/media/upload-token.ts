import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Short-lived signed token authorizing one direct upload to a specific object
 * key. Format: `base64url(payload).base64url(hmacSha256)`. Signed with the JWT
 * access secret (no extra secret to manage).
 */
export interface UploadTokenPayload {
  key: string;
  photoId: string;
  organizationId: string;
  mediaType: 'photo' | 'video';
  maxBytes: number;
  exp: number; // unix seconds
}

const b64url = (b: Buffer) =>
  b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

export function signUploadToken(
  payload: UploadTokenPayload,
  secret: string,
): string {
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(createHmac('sha256', secret).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyUploadToken(
  token: string,
  secret: string,
): UploadTokenPayload {
  const dot = token.indexOf('.');
  if (dot <= 0) throw new Error('Malformed upload token.');
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = b64url(createHmac('sha256', secret).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Invalid upload token signature.');
  }

  const payload = JSON.parse(
    Buffer.from(body, 'base64').toString(),
  ) as UploadTokenPayload;
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Upload token expired.');
  }
  return payload;
}

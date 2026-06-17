import {
  signUploadToken,
  UploadTokenPayload,
  verifyUploadToken,
} from './upload-token';

const SECRET = 'a-very-long-test-secret-at-least-32-chars';

function payload(over: Partial<UploadTokenPayload> = {}): UploadTokenPayload {
  return {
    key: 'org/o/media/p/raw.jpg',
    photoId: 'p',
    organizationId: 'o',
    mediaType: 'photo',
    maxBytes: 50_000_000,
    exp: Math.floor(Date.now() / 1000) + 600,
    ...over,
  };
}

describe('upload token', () => {
  it('round-trips a valid token', () => {
    const token = signUploadToken(payload(), SECRET);
    const decoded = verifyUploadToken(token, SECRET);
    expect(decoded.key).toBe('org/o/media/p/raw.jpg');
    expect(decoded.maxBytes).toBe(50_000_000);
  });

  it('rejects a token signed with a different secret', () => {
    const token = signUploadToken(payload(), SECRET);
    expect(() =>
      verifyUploadToken(token, 'another-secret-that-is-also-long'),
    ).toThrow();
  });

  it('rejects a tampered payload', () => {
    const token = signUploadToken(payload(), SECRET);
    const [, sig] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify(payload({ maxBytes: 9_999_999_999 })),
    ).toString('base64url');
    expect(() => verifyUploadToken(`${forged}.${sig}`, SECRET)).toThrow();
  });

  it('rejects an expired token', () => {
    const token = signUploadToken(
      payload({ exp: Math.floor(Date.now() / 1000) - 10 }),
      SECRET,
    );
    expect(() => verifyUploadToken(token, SECRET)).toThrow(/expired/i);
  });
});

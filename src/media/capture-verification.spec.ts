import {
  CaptureEvidence,
  deriveVerification,
  signCapture,
  SignedRecord,
} from './capture-verification';

const baseEvidence = (over: Partial<CaptureEvidence> = {}): CaptureEvidence => ({
  source: 'camera',
  capturedAt: new Date('2026-06-18T10:00:00Z'),
  latitude: 41.01,
  longitude: 28.97,
  locationAccuracyM: 12,
  locationFixAt: new Date('2026-06-18T09:59:55Z'), // 5s before capture
  isLocationSimulated: false,
  ...over,
});

describe('deriveVerification', () => {
  const atCapture = new Date('2026-06-18T10:00:10Z'); // 10s skew, in tolerance

  it('verifies a fresh, accurate, real camera fix', () => {
    const { verification, clockSkewSeconds } = deriveVerification(
      baseEvidence(),
      atCapture,
    );
    expect(verification).toBe('verified');
    expect(clockSkewSeconds).toBeCloseTo(10);
  });

  it('flags a simulated location', () => {
    const { verification } = deriveVerification(
      baseEvidence({ isLocationSimulated: true }),
      atCapture,
    );
    expect(verification).toBe('flagged');
  });

  it('flags excessive clock skew', () => {
    const farFuture = new Date('2026-06-18T10:05:00Z'); // 5 min skew
    const { verification } = deriveVerification(baseEvidence(), farFuture);
    expect(verification).toBe('flagged');
  });

  it('marks imports unverified even with full evidence', () => {
    const { verification } = deriveVerification(
      baseEvidence({ source: 'imported' }),
      atCapture,
    );
    expect(verification).toBe('unverified');
  });

  it('marks a stale fix unverified', () => {
    const { verification } = deriveVerification(
      baseEvidence({ locationFixAt: new Date('2026-06-18T09:59:00Z') }), // 60s old
      atCapture,
    );
    expect(verification).toBe('unverified');
  });

  it('marks a low-accuracy fix unverified', () => {
    const { verification } = deriveVerification(
      baseEvidence({ locationAccuracyM: 500 }),
      atCapture,
    );
    expect(verification).toBe('unverified');
  });

  it('marks a missing location unverified', () => {
    const { verification } = deriveVerification(
      baseEvidence({ latitude: null, longitude: null }),
      atCapture,
    );
    expect(verification).toBe('unverified');
  });
});

describe('signCapture (tamper-evidence)', () => {
  const record = (over: Partial<SignedRecord> = {}): SignedRecord => ({
    ...baseEvidence(),
    id: '11111111-1111-1111-1111-111111111111',
    authorMemberId: '22222222-2222-2222-2222-222222222222',
    verification: 'verified',
    serverReceivedAt: new Date('2026-06-18T10:00:10Z'),
    ...over,
  });

  it('is stable for the same record', () => {
    expect(signCapture(record(), 'secret')).toBe(signCapture(record(), 'secret'));
  });

  it('changes when the location is altered after signing', () => {
    const original = signCapture(record(), 'secret');
    const tampered = signCapture(record({ latitude: 0 }), 'secret');
    expect(tampered).not.toBe(original);
  });

  it('changes when the verdict is altered', () => {
    const original = signCapture(record(), 'secret');
    const tampered = signCapture(record({ verification: 'unverified' }), 'secret');
    expect(tampered).not.toBe(original);
  });

  it('depends on the secret', () => {
    expect(signCapture(record(), 'a')).not.toBe(signCapture(record(), 'b'));
  });
});

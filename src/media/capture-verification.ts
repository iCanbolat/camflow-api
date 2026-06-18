import { createHmac } from 'crypto';

/**
 * Server-side trust derivation for a photo's location/time stamp. The client
 * supplies capture evidence (where/when the fix was taken, its accuracy, and
 * whether the OS reported a simulated location); the server pairs that with its
 * own clock to decide how much the stamp can be trusted, then seals the whole
 * record with an HMAC so any later edit is detectable.
 *
 * This is evidence-grading + tamper-evidence, not physical-presence proof —
 * the latter needs device attestation (App Attest), tracked separately.
 */

/** Max acceptable horizontal accuracy (metres) for a `verified` stamp. */
export const ACCURACY_MAX_M = 50;
/** Max gap (seconds) between the GPS fix and the capture for it to count fresh. */
export const STALE_MAX_S = 20;
/** Max |device clock − server clock| (seconds) before the stamp is suspicious. */
export const SKEW_MAX_S = 120;

export type Verification = 'verified' | 'unverified' | 'flagged';

export interface CaptureEvidence {
  source: string | null; // 'camera' | 'imported'
  capturedAt: Date;
  latitude: number | null;
  longitude: number | null;
  locationAccuracyM: number | null;
  locationFixAt: Date | null;
  isLocationSimulated: boolean;
}

/**
 * Grades the capture evidence against the server clock.
 * - `flagged`: a malice signal (simulated location, or clock skew beyond
 *   tolerance) — surfaced loudly rather than silently downgraded.
 * - `verified`: camera source with a fresh, accurate, non-simulated fix.
 * - `unverified`: everything else (imports, missing/weak/stale location).
 */
export function deriveVerification(
  ev: CaptureEvidence,
  serverReceivedAt: Date,
): { verification: Verification; clockSkewSeconds: number } {
  const clockSkewSeconds =
    (serverReceivedAt.getTime() - ev.capturedAt.getTime()) / 1000;

  if (ev.isLocationSimulated) return { verification: 'flagged', clockSkewSeconds };
  if (Math.abs(clockSkewSeconds) > SKEW_MAX_S) {
    return { verification: 'flagged', clockSkewSeconds };
  }

  const hasLocation = ev.latitude != null && ev.longitude != null;
  const accurate =
    ev.locationAccuracyM != null && ev.locationAccuracyM <= ACCURACY_MAX_M;
  const fresh =
    ev.locationFixAt != null &&
    Math.abs(ev.capturedAt.getTime() - ev.locationFixAt.getTime()) / 1000 <=
      STALE_MAX_S;

  if (ev.source === 'camera' && hasLocation && accurate && fresh) {
    return { verification: 'verified', clockSkewSeconds };
  }
  return { verification: 'unverified', clockSkewSeconds };
}

export interface SignedRecord extends CaptureEvidence {
  id: string;
  authorMemberId: string | null;
  verification: Verification;
  serverReceivedAt: Date;
}

/**
 * HMAC-SHA256 over the canonical capture record. Re-deriving this later and
 * comparing detects any post-commit edit to the stamp or its verdict.
 */
export function signCapture(rec: SignedRecord, secret: string): string {
  const canonical = [
    rec.id,
    rec.source ?? '',
    rec.capturedAt.toISOString(),
    rec.latitude ?? '',
    rec.longitude ?? '',
    rec.locationAccuracyM ?? '',
    rec.locationFixAt ? rec.locationFixAt.toISOString() : '',
    rec.isLocationSimulated ? '1' : '0',
    rec.authorMemberId ?? '',
    rec.verification,
    rec.serverReceivedAt.toISOString(),
  ].join('|');
  return createHmac('sha256', secret).update(canonical).digest('hex');
}

import sharp from 'sharp';

export interface WatermarkInfo {
  companyName: string;
  capturedAt: Date;
  latitude?: number | null;
  longitude?: number | null;
  /** Horizontal accuracy in metres, shown as `±Xm` next to the GPS fix. */
  accuracyM?: number | null;
  /** Server verdict; only `verified` earns the visible ✓. */
  verification?: 'verified' | 'unverified' | 'flagged';
  /** Full capture signature; the trailing 8 hex are shown as a proof token. */
  signature?: string | null;
}

export interface ProcessedImage {
  processed: Buffer;
  thumbnail: Buffer;
  watermarked: Buffer;
  width: number;
  height: number;
}

const MAX_DIMENSION = 2048;
const THUMB_DIMENSION = 400;

/**
 * Server-side equivalent of the iOS `PhotoExporter`: compress + auto-orient,
 * generate a thumbnail, and bake a branded watermark bar (company, timestamp,
 * GPS, CamFlow signature) into a separate variant. The processed (un-branded)
 * image is preserved alongside the watermarked one.
 */
export async function processImage(
  raw: Buffer,
  wm: WatermarkInfo,
): Promise<ProcessedImage> {
  const oriented = sharp(raw, { failOn: 'none' }).rotate();

  const processed = await oriented
    .clone()
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();

  const meta = await sharp(processed).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  const thumbnail = await sharp(processed)
    .resize({ width: THUMB_DIMENSION, height: THUMB_DIMENSION, fit: 'inside' })
    .jpeg({ quality: 70, mozjpeg: true })
    .toBuffer();

  const svg = buildWatermarkSvg(width, height, wm);
  const watermarked = await sharp(processed)
    .composite([{ input: Buffer.from(svg), gravity: 'south' }])
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  return { processed, thumbnail, watermarked, width, height };
}

function buildWatermarkSvg(
  width: number,
  height: number,
  wm: WatermarkInfo,
): string {
  const barHeight = Math.max(44, Math.round(width * 0.05));
  const pad = Math.round(barHeight * 0.3);
  const fontSize = Math.round(barHeight * 0.32);
  const baseline = Math.round(barHeight * 0.62);

  const date = wm.capturedAt.toISOString().replace('T', ' ').slice(0, 16);
  const accuracy =
    wm.latitude != null && wm.longitude != null && wm.accuracyM != null
      ? ` ±${Math.round(wm.accuracyM)}m`
      : '';
  const gps =
    wm.latitude != null && wm.longitude != null
      ? `  ·  ${wm.latitude.toFixed(5)}, ${wm.longitude.toFixed(5)}${accuracy}`
      : '';
  // The ✓ is the visible attestation: only a server-`verified` stamp earns it.
  const mark = wm.verification === 'verified' ? '✓ ' : '';
  const token =
    wm.signature && wm.signature.length >= 8
      ? `  #${wm.signature.slice(-8)}`
      : '';
  const left = escapeXml(truncate(wm.companyName, 40));
  const center = escapeXml(`${mark}${date}${gps}`);
  const right = escapeXml(`CamFlow${token}`);

  return `<svg width="${width}" height="${barHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${width}" height="${barHeight}" fill="black" fill-opacity="0.45"/>
  <text x="${pad}" y="${baseline}" fill="white" font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="600">${left}</text>
  <text x="${width / 2}" y="${baseline}" fill="white" fill-opacity="0.9" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}">${center}</text>
  <text x="${width - pad}" y="${baseline}" fill="white" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="700">${right}</text>
</svg>`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

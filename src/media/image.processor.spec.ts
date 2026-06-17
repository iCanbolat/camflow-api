import sharp from 'sharp';
import { processImage } from './image.processor';

describe('image processor (sharp)', () => {
  it('produces compressed, thumbnail and watermarked JPEGs', async () => {
    const source = await sharp({
      create: {
        width: 3000,
        height: 2000,
        channels: 3,
        background: { r: 30, g: 90, b: 160 },
      },
    })
      .jpeg()
      .toBuffer();

    const out = await processImage(source, {
      companyName: 'Demo Construction Co.',
      capturedAt: new Date('2026-06-17T10:00:00Z'),
      latitude: 41.01,
      longitude: 28.97,
    });

    const processed = await sharp(out.processed).metadata();
    const thumb = await sharp(out.thumbnail).metadata();
    const wm = await sharp(out.watermarked).metadata();

    expect(processed.format).toBe('jpeg');
    expect(processed.width).toBeLessThanOrEqual(2048);
    expect(processed.height).toBeLessThanOrEqual(2048);
    expect(thumb.width).toBeLessThanOrEqual(400);
    expect(wm.format).toBe('jpeg');
    expect(wm.width).toBe(processed.width);
    // The watermark bar changes the bytes vs the clean processed image.
    expect(out.watermarked.length).not.toBe(out.processed.length);
  });
});

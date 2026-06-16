import { spawn } from 'child_process';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

export interface ProcessedVideo {
  processed: Buffer; // H.264 mp4, faststart
  poster: Buffer; // first-frame JPEG
}

/**
 * Compresses a video to H.264 mp4 and extracts a poster frame via the `ffmpeg`
 * CLI (no extra dependency). Throws a clear error if ffmpeg is not installed.
 */
export async function processVideo(raw: Buffer): Promise<ProcessedVideo> {
  const dir = await mkdtemp(join(tmpdir(), 'camflow-media-'));
  const inPath = join(dir, 'in');
  const outPath = join(dir, 'out.mp4');
  const posterPath = join(dir, 'poster.jpg');

  try {
    await writeFile(inPath, raw);
    await runFfmpeg([
      '-y',
      '-i',
      inPath,
      '-vcodec',
      'libx264',
      '-crf',
      '28',
      '-preset',
      'veryfast',
      '-vf',
      'scale=min(1280\\,iw):-2',
      '-acodec',
      'aac',
      '-movflags',
      '+faststart',
      outPath,
    ]);
    await runFfmpeg(['-y', '-i', inPath, '-frames:v', '1', '-q:v', '3', posterPath]);

    const [processed, poster] = await Promise.all([
      readFile(outPath),
      readFile(posterPath),
    ]);
    return { processed, poster };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('error', (err: NodeJS.ErrnoException) => {
      reject(
        err.code === 'ENOENT'
          ? new Error('ffmpeg is not installed on the worker host.')
          : err,
      );
    });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}
